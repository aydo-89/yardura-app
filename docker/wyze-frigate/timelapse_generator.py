#!/usr/bin/env python3
"""
Timelapse Video Generator for Dog Behavior Monitoring
Creates daily/weekly timelapse videos from Frigate recordings
"""

import os
import subprocess
import requests
import json
from datetime import datetime, timedelta
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TimelapseGenerator:
    def __init__(self, frigate_url: str = "http://localhost:5001", output_dir: str = "/app/data/timelapses"):
        self.frigate_url = frigate_url
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def get_recordings(self, camera: str, start_time: datetime, end_time: datetime):
        """Get recording segments from Frigate for a time period"""
        try:
            url = f"{self.frigate_url}/api/{camera}/recordings"
            params = {
                'after': int(start_time.timestamp()),
                'before': int(end_time.timestamp())
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Error fetching recordings: {e}")
            return []
    
    def create_daily_timelapse(self, camera: str = "yard", date: datetime = None):
        """Create a timelapse for a specific day"""
        if date is None:
            date = datetime.now() - timedelta(days=1)  # Yesterday
        
        start_time = date.replace(hour=6, minute=0, second=0, microsecond=0)  # Start at 6 AM
        end_time = date.replace(hour=22, minute=0, second=0, microsecond=0)   # End at 10 PM
        
        logger.info(f"Creating timelapse for {camera} on {date.strftime('%Y-%m-%d')}")
        
        # Get recordings for the day
        recordings = self.get_recordings(camera, start_time, end_time)
        
        if not recordings:
            logger.warning(f"No recordings found for {date.strftime('%Y-%m-%d')}")
            return None
        
        # Create output filename
        output_file = self.output_dir / f"{camera}_timelapse_{date.strftime('%Y%m%d')}.mp4"
        
        # Build ffmpeg command for timelapse
        # This creates a 60x speed timelapse at 25fps
        cmd = [
            'ffmpeg', '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', '-',  # Read from stdin
            '-vf', 'setpts=PTS/60',  # 60x speed
            '-r', '25',  # 25fps output
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            str(output_file)
        ]
        
        # Create input list for ffmpeg
        input_list = ""
        for recording in recordings:
            recording_path = f"/media/frigate/recordings/{camera}/{recording['path']}"
            input_list += f"file '{recording_path}'\n"
        
        try:
            # Run ffmpeg with input list
            process = subprocess.Popen(cmd, stdin=subprocess.PIPE, text=True)
            process.communicate(input=input_list)
            
            if process.returncode == 0:
                logger.info(f"Timelapse created: {output_file}")
                return str(output_file)
            else:
                logger.error(f"ffmpeg failed with return code {process.returncode}")
                return None
                
        except Exception as e:
            logger.error(f"Error creating timelapse: {e}")
            return None
    
    def create_behavior_highlight_reel(self, camera: str = "yard", days: int = 7):
        """Create a highlight reel of dog behavior events"""
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days)
        
        logger.info(f"Creating behavior highlight reel for last {days} days")
        
        # Get dog detection events
        try:
            url = f"{self.frigate_url}/api/events"
            params = {
                'camera': camera,
                'label': 'dog',
                'after': int(start_time.timestamp()),
                'before': int(end_time.timestamp()),
                'limit': 50  # Top 50 events
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            events = response.json()
            
        except Exception as e:
            logger.error(f"Error fetching events: {e}")
            return None
        
        if not events:
            logger.warning("No dog events found for highlight reel")
            return None
        
        # Create clips from events
        clips = []
        for event in events:
            if event.get('has_clip'):
                clip_path = f"/media/frigate/clips/{event['id']}.mp4"
                if os.path.exists(clip_path):
                    clips.append(clip_path)
        
        if not clips:
            logger.warning("No clips found for highlight reel")
            return None
        
        # Create output filename
        output_file = self.output_dir / f"{camera}_highlights_{end_time.strftime('%Y%m%d')}.mp4"
        
        # Create concatenated highlight reel
        input_list = ""
        for clip in clips[:20]:  # Limit to 20 clips
            input_list += f"file '{clip}'\n"
        
        cmd = [
            'ffmpeg', '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', '-',
            '-c', 'copy',
            str(output_file)
        ]
        
        try:
            process = subprocess.Popen(cmd, stdin=subprocess.PIPE, text=True)
            process.communicate(input=input_list)
            
            if process.returncode == 0:
                logger.info(f"Highlight reel created: {output_file}")
                return str(output_file)
            else:
                logger.error(f"ffmpeg failed creating highlight reel")
                return None
                
        except Exception as e:
            logger.error(f"Error creating highlight reel: {e}")
            return None
    
    def run_daily_generation(self):
        """Daily cron-like function to generate timelapses"""
        logger.info("Running daily timelapse generation...")
        
        # Generate yesterday's timelapse
        daily_file = self.create_daily_timelapse()
        
        # Generate weekly highlight reel on Sundays
        if datetime.now().weekday() == 6:  # Sunday
            highlight_file = self.create_behavior_highlight_reel()
        
        logger.info("Daily timelapse generation complete")

if __name__ == "__main__":
    generator = TimelapseGenerator()
    
    # For testing, create today's timelapse
    generator.create_daily_timelapse(date=datetime.now())
    
    # For production, run daily generation
    # generator.run_daily_generation()