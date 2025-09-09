#!/usr/bin/env python3
"""
Download and save Runway generated images locally
"""

import os
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    from runwayml import RunwayML, TaskFailedError
except ImportError:
    print("❌ Please install the Runway SDK first:")
    print("   pip install runwayml")
    exit(1)

def download_image(url, filepath):
    """Download an image from URL and save it locally"""
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return True
    except Exception as e:
        print(f"❌ Failed to download image: {e}")
        return False

def generate_and_download_wastewell_images():
    """Generate and immediately download WasteWell lifestyle images"""
    
    api_key = os.getenv('RUNWAY_API_KEY')
    if not api_key:
        print("❌ Please set RUNWAY_API_KEY in your .env file")
        return
    
    client = RunwayML(api_key=api_key)
    
    # Create output directory
    output_dir = Path("downloaded_wastewell_images")
    output_dir.mkdir(exist_ok=True)
    
    # WasteWell reference images
    wastewell_references = [
        {
            'uri': 'https://yardura.com/WasteWell1.png',
            'tag': 'WasteWell'
        }
    ]
    
    # Lifestyle scenarios with natural, realistic placement
    scenarios = [
        {
            'name': 'patio_side_placement',
            'prompt': 'Luxury outdoor patio with modern furniture and fire pit, @WasteWell discretely positioned to the side near a planter box, partially hidden by landscaping, warm evening lighting, the bin blends naturally into the sophisticated outdoor environment without being the focus',
            'description': 'Patio with natural side placement'
        },
        {
            'name': 'pathway_corner_discrete', 
            'prompt': 'Beautiful garden pathway with stone walkway and lush plantings, @WasteWell tucked into a corner near a garden bed alongside decorative outdoor lighting, positioned where a homeowner would naturally place it for convenience, elegant landscape design',
            'description': 'Garden pathway corner placement'
        },
        {
            'name': 'seating_area_adjacent',
            'prompt': 'Luxurious outdoor seating area with sectional sofa and coffee table, @WasteWell positioned off to the side near the edge of the seating area, close enough for convenience but not intrusive, warm ambient lighting, professional landscape design',
            'description': 'Adjacent to seating area'
        },
        {
            'name': 'poolside_discrete_corner',
            'prompt': 'Elegant pool deck with lounge chairs and umbrellas, @WasteWell placed discretely in a corner near poolside landscaping, positioned where pool users would naturally access it, sophisticated resort-style setting, the bin appears natural and unobtrusive',
            'description': 'Poolside corner placement'
        },
        {
            'name': 'outdoor_dining_nearby',
            'prompt': 'Upscale outdoor dining area with table and chairs, @WasteWell positioned nearby but to the side, close to where pet owners would need it during outdoor meals, integrated with decorative planters and lighting, luxury patio setting',
            'description': 'Near outdoor dining area'
        }
    ]
    
    print("🎬 Generating and downloading WasteWell lifestyle images...")
    print(f"📁 Images will be saved to: {output_dir}")
    
    downloaded_count = 0
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"\n🎨 [{i}/4] Generating: {scenario['description']}")
        
        try:
            # Create image generation task
            task = client.text_to_image.create(
                model='gen4_image',
                ratio='1920:1080',  # Landscape format for hero images
                prompt_text=scenario['prompt'],
                reference_images=wastewell_references
            ).wait_for_task_output()
            
            print(f"✅ Generation complete: {scenario['name']}")
            
            # Download the image immediately while the URL is valid
            if task.output and len(task.output) > 0:
                image_url = task.output[0]
                output_file = output_dir / f"{scenario['name']}_wastewell.png"
                
                print(f"📥 Downloading to: {output_file}")
                
                if download_image(image_url, output_file):
                    print(f"✅ Downloaded: {output_file}")
                    downloaded_count += 1
                    
                    # Also save the metadata
                    info_file = output_dir / f"{scenario['name']}_info.txt"
                    with open(info_file, 'w') as f:
                        f.write(f"Generated: {scenario['description']}\n")
                        f.write(f"Prompt: {scenario['prompt']}\n")
                        f.write(f"Original URL: {image_url}\n")
                        f.write(f"Local file: {output_file}\n")
                else:
                    print(f"❌ Failed to download {scenario['name']}")
                
            else:
                print(f"❌ No output generated for {scenario['name']}")
                
        except TaskFailedError as e:
            print(f"❌ Generation failed for {scenario['name']}")
            print(f"   Error: {e.task_details}")
        except Exception as e:
            print(f"❌ Unexpected error for {scenario['name']}: {e}")
    
    print(f"\n🎉 Complete! Downloaded {downloaded_count}/4 images to: {output_dir}")
    
    # List the downloaded files
    if downloaded_count > 0:
        print("\n📁 Downloaded files:")
        for file in sorted(output_dir.glob("*.png")):
            size_mb = file.stat().st_size / (1024 * 1024)
            print(f"   {file.name} ({size_mb:.1f} MB)")

if __name__ == "__main__":
    print("🎭 WasteWell Image Generator & Downloader")
    print("=" * 45)
    generate_and_download_wastewell_images() 