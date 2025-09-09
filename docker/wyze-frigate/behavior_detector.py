#!/usr/bin/env python3
"""
Advanced Dog Behavior Detection for Frigate
Detects specific behaviors: digging, rolling, eating grass/poop, prolonged barking
"""

import cv2
import numpy as np
import requests
import json
import time
import sqlite3
import os
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DogBehaviorDetector:
    def __init__(self, frigate_url: str = None):
        if frigate_url is None:
            frigate_url = os.getenv('FRIGATE_URL', 'http://localhost:5001')
        self.frigate_url = frigate_url
        self.behavior_history = []
        self.last_positions = {}
        self.behavior_thresholds = {
            'digging': {
                'min_duration': 5,  # seconds
                'motion_threshold': 0.3,
                'position_variance': 100  # pixels
            },
            'rolling': {
                'min_duration': 3,
                'motion_threshold': 0.4,
                'aspect_ratio_change': 0.5
            },
            'eating': {
                'min_duration': 10,
                'head_down_threshold': 0.7,
                'stationary_threshold': 50  # pixels
            },
            'prolonged_barking': {
                'min_duration': 30,  # 30+ seconds of barking
                'bark_frequency': 3   # barks per 10-second window
            }
        }
        
        # Initialize behavior tracking database
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database for behavior tracking"""
        self.conn = sqlite3.connect('dog_behaviors.db')
        cursor = self.conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS behaviors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME,
                behavior_type TEXT,
                duration REAL,
                confidence REAL,
                zone TEXT,
                notes TEXT
            )
        ''')
        self.conn.commit()
    
    def get_recent_detections(self, camera: str = "yard", minutes: int = 5) -> List[Dict]:
        """Get recent dog detections from Frigate API"""
        try:
            end_time = int(time.time())
            start_time = end_time - (minutes * 60)
            
            url = f"{self.frigate_url}/api/events"
            params = {
                'camera': camera,
                'label': 'dog',
                'after': start_time,
                'before': end_time,
                'include_thumbnails': False
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Error fetching detections: {e}")
            return []
    
    def get_audio_events(self, camera: str = "yard", minutes: int = 5) -> List[Dict]:
        """Get recent bark audio events from Frigate"""
        try:
            end_time = int(time.time())
            start_time = end_time - (minutes * 60)
            
            url = f"{self.frigate_url}/api/events"
            params = {
                'camera': camera,
                'label': 'bark',
                'after': start_time,
                'before': end_time
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Error fetching audio events: {e}")
            return []
    
    def analyze_digging_behavior(self, detections: List[Dict]) -> Optional[Dict]:
        """Analyze if dog is digging based on position consistency and motion"""
        if len(detections) < 3:
            return None
        
        # Group detections by time windows
        recent_positions = []
        for detection in detections[-10:]:  # Last 10 detections
            box = detection.get('box', {})
            if box:
                center_x = box['x'] + box['width'] / 2
                center_y = box['y'] + box['height'] / 2
                recent_positions.append((center_x, center_y, detection['start_time']))
        
        if len(recent_positions) < 5:
            return None
        
        # Calculate position variance (low variance = stationary)
        positions = np.array([(x, y) for x, y, _ in recent_positions])
        position_variance = np.var(positions, axis=0).sum()
        
        # Check if dog stayed in roughly same area (indicating digging)
        if position_variance < self.behavior_thresholds['digging']['position_variance']:
            duration = recent_positions[-1][2] - recent_positions[0][2]
            if duration >= self.behavior_thresholds['digging']['min_duration']:
                return {
                    'behavior': 'digging',
                    'confidence': min(1.0, (1.0 - position_variance / 1000)),
                    'duration': duration,
                    'location': (positions.mean(axis=0)[0], positions.mean(axis=0)[1])
                }
        
        return None
    
    def analyze_rolling_behavior(self, detections: List[Dict]) -> Optional[Dict]:
        """Analyze if dog is rolling based on aspect ratio changes"""
        if len(detections) < 3:
            return None
        
        aspect_ratios = []
        for detection in detections[-5:]:
            box = detection.get('box', {})
            if box and box['height'] > 0:
                aspect_ratio = box['width'] / box['height']
                aspect_ratios.append((aspect_ratio, detection['start_time']))
        
        if len(aspect_ratios) < 3:
            return None
        
        # Look for significant aspect ratio changes (wide to tall or vice versa)
        ratios = [r for r, _ in aspect_ratios]
        max_ratio = max(ratios)
        min_ratio = min(ratios)
        ratio_variance = max_ratio - min_ratio
        
        if ratio_variance > self.behavior_thresholds['rolling']['aspect_ratio_change']:
            duration = aspect_ratios[-1][1] - aspect_ratios[0][1]
            if duration >= self.behavior_thresholds['rolling']['min_duration']:
                return {
                    'behavior': 'rolling',
                    'confidence': min(1.0, ratio_variance),
                    'duration': duration,
                    'aspect_ratio_change': ratio_variance
                }
        
        return None
    
    def analyze_eating_behavior(self, detections: List[Dict]) -> Optional[Dict]:
        """Analyze if dog is eating based on head position and duration"""
        if len(detections) < 5:
            return None
        
        # Look for consistent low head position (bottom of bounding box close to ground)
        head_positions = []
        for detection in detections[-8:]:
            box = detection.get('box', {})
            if box:
                # Approximate head position as top-center of bounding box
                head_y = box['y']
                box_height = box['height']
                ground_proximity = 1.0 - (head_y / 1080)  # Assuming 1080p resolution
                head_positions.append((ground_proximity, detection['start_time']))
        
        if not head_positions:
            return None
        
        # Check if head consistently low (eating/sniffing)
        avg_ground_proximity = np.mean([pos for pos, _ in head_positions])
        if avg_ground_proximity > self.behavior_thresholds['eating']['head_down_threshold']:
            duration = head_positions[-1][1] - head_positions[0][1]
            if duration >= self.behavior_thresholds['eating']['min_duration']:
                return {
                    'behavior': 'eating_or_sniffing',
                    'confidence': avg_ground_proximity,
                    'duration': duration,
                    'head_down_ratio': avg_ground_proximity
                }
        
        return None
    
    def analyze_barking_behavior(self, audio_events: List[Dict]) -> Optional[Dict]:
        """Analyze prolonged barking patterns"""
        if not audio_events:
            return None
        
        # Group barks by time windows
        bark_times = [event['start_time'] for event in audio_events]
        if not bark_times:
            return None
        
        bark_times.sort()
        total_duration = bark_times[-1] - bark_times[0] if len(bark_times) > 1 else 0
        bark_frequency = len(bark_times) / max(1, total_duration / 60)  # barks per minute
        
        if (total_duration >= self.behavior_thresholds['prolonged_barking']['min_duration'] and
            bark_frequency >= self.behavior_thresholds['prolonged_barking']['bark_frequency']):
            return {
                'behavior': 'prolonged_barking',
                'confidence': min(1.0, bark_frequency / 10),
                'duration': total_duration,
                'bark_count': len(bark_times),
                'frequency': bark_frequency
            }
        
        return None
    
    def save_behavior(self, behavior: Dict):
        """Save detected behavior to database"""
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO behaviors (timestamp, behavior_type, duration, confidence, zone, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            datetime.now(),
            behavior['behavior'],
            behavior.get('duration', 0),
            behavior.get('confidence', 0),
            behavior.get('zone', 'yard'),
            json.dumps(behavior)
        ))
        self.conn.commit()
        logger.info(f"Saved behavior: {behavior['behavior']} (confidence: {behavior.get('confidence', 0):.2f})")
    
    def send_alert(self, behavior: Dict):
        """Send alert via webhook or API (placeholder for Home Assistant integration)"""
        # This would integrate with Home Assistant or send push notifications
        logger.info(f"🚨 ALERT: {behavior['behavior'].upper()} detected!")
        logger.info(f"   Duration: {behavior.get('duration', 0):.1f}s")
        logger.info(f"   Confidence: {behavior.get('confidence', 0):.2f}")
        
        # TODO: Implement Home Assistant webhook
        # webhook_url = "http://homeassistant:8123/api/webhook/dog_behavior"
        # requests.post(webhook_url, json=behavior)
    
    def run_analysis(self):
        """Main analysis loop"""
        logger.info("Starting dog behavior detection...")
        
        while True:
            try:
                # Get recent detections and audio events
                detections = self.get_recent_detections()
                audio_events = self.get_audio_events()
                
                # Analyze different behaviors
                behaviors = []
                
                digging = self.analyze_digging_behavior(detections)
                if digging:
                    behaviors.append(digging)
                
                rolling = self.analyze_rolling_behavior(detections)
                if rolling:
                    behaviors.append(rolling)
                
                eating = self.analyze_eating_behavior(detections)
                if eating:
                    behaviors.append(eating)
                
                barking = self.analyze_barking_behavior(audio_events)
                if barking:
                    behaviors.append(barking)
                
                # Process detected behaviors
                for behavior in behaviors:
                    # Check if we've already alerted for this behavior recently
                    recent_alerts = [b for b in self.behavior_history 
                                   if b['behavior'] == behavior['behavior'] 
                                   and time.time() - b['timestamp'] < 300]  # 5 minutes
                    
                    if not recent_alerts:
                        self.save_behavior(behavior)
                        self.send_alert(behavior)
                        behavior['timestamp'] = time.time()
                        self.behavior_history.append(behavior)
                
                # Clean old history
                self.behavior_history = [b for b in self.behavior_history 
                                       if time.time() - b['timestamp'] < 3600]  # 1 hour
                
                time.sleep(10)  # Check every 10 seconds
                
            except Exception as e:
                logger.error(f"Error in analysis loop: {e}")
                time.sleep(30)  # Wait longer on error

if __name__ == "__main__":
    detector = DogBehaviorDetector()
    detector.run_analysis()