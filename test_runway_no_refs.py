#!/usr/bin/env python3
"""
Test Runway without reference images - just text-based generation
"""

import os
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

def test_text_only_generation():
    """Test Runway with text prompts only (no reference images)"""
    
    api_key = os.getenv('RUNWAY_API_KEY')
    if not api_key:
        print("❌ Please set RUNWAY_API_KEY in your .env file")
        return
    
    client = RunwayML(api_key=api_key)
    
    # Create output directory
    output_dir = Path("runway_outputs")
    output_dir.mkdir(exist_ok=True)
    
    # Test scenarios focused on WasteWell-style products
    scenarios = [
        {
            'name': 'wastewell_style_patio',
            'prompt': 'A beautiful modern outdoor waste bin with LED lighting, bronze finish, elegant design, placed on a luxurious patio with contemporary furniture, warm ambient lighting, professional product photography',
            'description': 'WasteWell-style product on modern patio'
        },
        {
            'name': 'premium_waste_station_garden',
            'prompt': 'An elegant outdoor pet waste station with LED halo lighting, premium bronze aluminum construction, positioned in a beautiful garden setting with lush landscaping, evening atmosphere, luxury product shot',
            'description': 'Premium waste station in garden'
        }
    ]
    
    print("🎬 Testing Runway text-only generation...")
    print(f"📁 Outputs will be saved to: {output_dir}")
    
    for scenario in scenarios:
        print(f"\n🎨 Generating: {scenario['description']}")
        
        try:
            # Create image generation task - text only
            task = client.text_to_image.create(
                model='gen4_image',
                ratio='1920:1080',
                prompt_text=scenario['prompt']
            ).wait_for_task_output()
            
            print(f"✅ Task complete: {scenario['name']}")
            
            if task.output and len(task.output) > 0:
                image_url = task.output[0]
                print(f"🖼️  Image URL: {image_url}")
                
                # Save the URL for reference
                output_file = output_dir / f"{scenario['name']}_info.txt"
                with open(output_file, 'w') as f:
                    f.write(f"Generated: {scenario['description']}\n")
                    f.write(f"Prompt: {scenario['prompt']}\n")
                    f.write(f"URL: {image_url}\n")
                
                print(f"💾 Info saved to: {output_file}")
                
            else:
                print(f"❌ No output generated for {scenario['name']}")
                
        except TaskFailedError as e:
            print(f"❌ Generation failed for {scenario['name']}")
            print(f"   Error: {e.task_details}")
        except Exception as e:
            print(f"❌ Unexpected error for {scenario['name']}: {e}")
    
    print("\n🎉 Text-only generation complete!")

if __name__ == "__main__":
    print("🎭 Runway Text-Only Test")
    print("=" * 30)
    test_text_only_generation() 