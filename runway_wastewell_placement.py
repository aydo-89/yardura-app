#!/usr/bin/env python3
"""
Official Runway API script for WasteWell product placement
Uses single reference images for maximum design fidelity
Following Runway Gen-4 best practices for exact product consistency
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

def setup_runway_client():
    """Initialize Runway client with API key"""
    api_key = os.getenv('RUNWAY_API_KEY')
    if not api_key:
        print("❌ Please set RUNWAY_API_KEY in your .env file")
        print("   Get your API key from: https://app.runwayml.com/")
        return None
    
    return RunwayML(api_key=api_key)

def download_image(url, output_path):
    """Download image from URL and save to local file"""
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"✅ Downloaded: {output_path}")
        return True
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return False

def create_wastewell_primary_hero_shots():
    """Generate hero shots using WasteWell1.png for maximum design fidelity"""
    
    client = setup_runway_client()
    if not client:
        return
    
    # Create output directory
    output_dir = Path("runway_outputs/primary_hero")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Single reference image - WasteWell1.png (most important)
    wastewell_primary = [{'uri': 'https://yardura.com/WasteWell1.png', 'tag': 'WasteWell1'}]
    
    # Hero shot scenarios with explicit design fidelity prompts
    hero_scenarios = [
        {
            'name': 'patio_corner_hero',
            'prompt': '@WasteWell1 precisely as shown in reference image, unchanged design and proportions, soft warm white LED glow around halo ring like elegant solar lighting at dusk, positioned in corner of residential backyard patio, natural stone pavers, outdoor furniture nearby, exact replica of original product, no design modifications, professional product photography, gentle twilight illumination, no people',
            'description': 'Patio corner - exact design replica with soft solar LED'
        },
        {
            'name': 'garden_pathway_hero',
            'prompt': '@WasteWell1 exactly as depicted in reference, maintaining all original details and colors, subtle warm white LED halo like premium solar garden light, naturally positioned beside residential garden pathway, mulched landscaping, suburban setting, original specifications preserved, architectural product photography, soft evening glow accent lighting, no people',
            'description': 'Garden pathway - original specifications with solar glow'
        },
        {
            'name': 'deck_dining_hero',
            'prompt': '@WasteWell1 identical to reference image, preserving exact appearance, gentle warm white LED ring glow like sophisticated solar lighting at twilight, elegantly placed near residential deck dining area, wooden decking, outdoor table background, unchanged product design, professional lifestyle photography, elegant dusk lighting accent, no people',
            'description': 'Deck dining - identical appearance with twilight LED'
        },
        {
            'name': 'poolside_hero',
            'prompt': '@WasteWell1 as shown in reference without modifications, exact colors and proportions, soft warm white LED glow around halo ring like premium solar lighting, positioned by residential swimming pool, suburban backyard, pool deck setting, original design maintained, clean product placement, gentle evening illumination, no people',
            'description': 'Poolside - original design maintained with solar LED'
        },
        {
            'name': 'fire_pit_hero',
            'prompt': '@WasteWell1 precisely matching reference image, all original details preserved, subtle warm white LED halo like elegant solar light at dusk, placed near residential fire pit area, stone seating, suburban backyard setting, exact product replica, warm evening lighting, soft twilight glow accent, no people',
            'description': 'Fire pit area - exact product replica with solar glow'
        },
        {
            'name': 'outdoor_kitchen_hero',
            'prompt': '@WasteWell1 true to reference specifications, maintaining original design integrity, gentle warm white LED ring glow like premium solar lighting at twilight, positioned near residential outdoor kitchen, built-in grill area, suburban setting, unchanged appearance, architectural photography, sophisticated dusk lighting accent, no people',
            'description': 'Outdoor kitchen - design integrity maintained with twilight LED'
        }
    ]
    
    print("🎬 Generating WasteWell PRIMARY hero shots (single reference for max fidelity)...")
    print(f"📁 Outputs will be saved to: {output_dir}")
    print(f"🔒 Using WasteWell1.png as single reference for exact design consistency")
    
    for scenario in hero_scenarios:
        print(f"\n🎨 Generating: {scenario['description']}")
        
        try:
            task = client.text_to_image.create(
                model='gen4_image',
                ratio='1920:1080',
                prompt_text=scenario['prompt'],
                reference_images=wastewell_primary
            ).wait_for_task_output()
            
            print(f"✅ Task complete: {scenario['name']}")
            
            if task.output and len(task.output) > 0:
                image_url = task.output[0]
                print(f"🖼️  Image URL: {image_url}")
                
                output_file = output_dir / f"{scenario['name']}.jpg"
                if download_image(image_url, output_file):
                    print(f"💾 Saved to: {output_file}")
                
            else:
                print(f"❌ No output generated for {scenario['name']}")
                
        except TaskFailedError as e:
            print(f"❌ Generation failed for {scenario['name']}")
            print(f"   Error: {e.task_details}")
        except Exception as e:
            print(f"❌ Unexpected error for {scenario['name']}: {e}")

def create_wastewell_component_detail_shots():
    """Generate component detail shots using WasteWell2.png for component focus"""
    
    client = setup_runway_client()
    if not client:
        return
    
    # Create output directory
    output_dir = Path("runway_outputs/component_details")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Single reference image - WasteWell2.png (component details)
    wastewell_components = [{'uri': 'https://yardura.com/WasteWell2.png', 'tag': 'WasteWell2'}]
    
    # Component detail scenarios with design fidelity focus
    component_scenarios = [
        {
            'name': 'components_residential_detail',
            'prompt': '@WasteWell2 exactly as shown in reference image, preserving all component details and assembly, positioned in upscale residential backyard setting, clean patio surface, original specifications unchanged, professional product photography, no people',
            'description': 'Component assembly - exact specifications'
        },
        {
            'name': 'components_garden_context',
            'prompt': '@WasteWell2 identical to reference design, maintaining precise component layout, natural placement in residential garden area, landscaped background, all original details preserved, architectural product shot, no people',
            'description': 'Garden context - precise layout preserved'
        },
        {
            'name': 'components_patio_integration',
            'prompt': '@WasteWell2 true to reference specifications, exact component configuration maintained, elegantly integrated into residential patio setting, outdoor furniture context, unchanged design fidelity, lifestyle product photography, no people',
            'description': 'Patio integration - configuration maintained'
        },
        {
            'name': 'components_poolside_placement',
            'prompt': '@WasteWell2 precisely matching reference image, all assembly details accurate, positioned near residential pool area, deck setting, original component specifications, clean modern placement, no people',
            'description': 'Poolside placement - assembly accurate'
        }
    ]
    
    print(f"\n🔧 Generating WasteWell COMPONENT detail shots (single reference)...")
    
    for scenario in component_scenarios:
        print(f"\n🎨 Generating: {scenario['description']}")
        
        try:
            task = client.text_to_image.create(
                model='gen4_image',
                ratio='1920:1080',
                prompt_text=scenario['prompt'],
                reference_images=wastewell_components
            ).wait_for_task_output()
            
            print(f"✅ Task complete: {scenario['name']}")
            
            if task.output and len(task.output) > 0:
                image_url = task.output[0]
                print(f"🖼️  Image URL: {image_url}")
                
                output_file = output_dir / f"{scenario['name']}.jpg"
                if download_image(image_url, output_file):
                    print(f"💾 Saved to: {output_file}")
                
            else:
                print(f"❌ No output generated for {scenario['name']}")
                
        except TaskFailedError as e:
            print(f"❌ Generation failed for {scenario['name']}")
            print(f"   Error: {e.task_details}")
        except Exception as e:
            print(f"❌ Unexpected error for {scenario['name']}: {e}")

def create_wastewell_lifestyle_context_shots():
    """Generate lifestyle context shots using WasteWell1.png for environmental integration"""
    
    client = setup_runway_client()
    if not client:
        return
    
    # Create output directory  
    output_dir = Path("runway_outputs/lifestyle_context")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Single reference image - WasteWell1.png for lifestyle shots
    wastewell_primary = [{'uri': 'https://yardura.com/WasteWell1.png', 'tag': 'WasteWell1'}]
    
    # Lifestyle scenarios with design preservation
    lifestyle_scenarios = [
        {
            'name': 'morning_backyard_context',
            'prompt': '@WasteWell1 appearing exactly as in reference image, no design alterations, positioned in beautiful morning residential backyard scene, fresh landscaping, patio furniture arranged, original product unchanged, natural morning light, no people',
            'description': 'Morning backyard - design unaltered'
        },
        {
            'name': 'entertaining_ready_context',
            'prompt': '@WasteWell1 maintaining reference image accuracy, all original details intact, discretely placed in residential entertaining area, outdoor dining setup, string lights, original specifications preserved, evening ambiance, no people',
            'description': 'Entertainment setup - details intact'
        },
        {
            'name': 'garden_maintenance_context',
            'prompt': '@WasteWell1 identical to reference design, preserving exact appearance, positioned in residential garden area, landscaping tools nearby, beautiful plantings, unchanged product design, functional context, no people',
            'description': 'Garden maintenance - exact appearance'
        },
        {
            'name': 'weekend_patio_context',
            'prompt': '@WasteWell1 true to original reference, maintaining design fidelity, integrated into weekend residential patio scene, outdoor furniture, grilling area, product specifications unchanged, lifestyle setting, no people',
            'description': 'Weekend patio - design fidelity maintained'
        }
    ]
    
    print(f"\n🏡 Generating WasteWell LIFESTYLE context shots (single reference)...")
    
    for scenario in lifestyle_scenarios:
        print(f"\n🎨 Generating: {scenario['description']}")
        
        try:
            task = client.text_to_image.create(
                model='gen4_image',
                ratio='1920:1080',
                prompt_text=scenario['prompt'],
                reference_images=wastewell_primary
            ).wait_for_task_output()
            
            print(f"✅ Task complete: {scenario['name']}")
            
            if task.output and len(task.output) > 0:
                image_url = task.output[0]
                print(f"🖼️  Image URL: {image_url}")
                
                output_file = output_dir / f"{scenario['name']}.jpg"
                if download_image(image_url, output_file):
                    print(f"💾 Saved to: {output_file}")
                
            else:
                print(f"❌ No output generated for {scenario['name']}")
                
        except TaskFailedError as e:
            print(f"❌ Generation failed for {scenario['name']}")
            print(f"   Error: {e.task_details}")
        except Exception as e:
            print(f"❌ Unexpected error for {scenario['name']}: {e}")

def create_simple_wastewell_test():
    """Generate simple test shots to verify the approach works"""
    
    client = setup_runway_client()
    if not client:
        return
    
    # Create output directory
    output_dir = Path("runway_outputs/simple_test")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Single reference image - WasteWell1.png
    wastewell_ref = [{'uri': 'https://yardura.com/WasteWell1.png', 'tag': 'WasteWell1'}]
    
    # Simple test scenarios with improved prompts
    test_scenarios = [
        {
            'name': 'luxury_patio_test',
            'prompt': '@WasteWell1 exactly as shown in reference, no design modifications, single Yardura logo only, soft warm white LED glow around halo ring like elegant solar lighting, positioned on modern luxury residential patio, contemporary stone pavers, upscale outdoor furniture, gentle twilight LED illumination, no people',
            'description': 'Luxury patio test - exact design with soft solar LED'
        },
        {
            'name': 'premium_garden_test',
            'prompt': '@WasteWell1 identical to reference design, original logo placement only, no additional branding, subtle warm white LED halo like solar garden light at dusk, placed in upscale residential garden, beautiful landscaping, premium outdoor setting, soft evening glow accent lighting, no people',
            'description': 'Premium garden test - original design with solar glow'
        },
        {
            'name': 'modern_deck_test',
            'prompt': '@WasteWell1 as shown in reference without changes, exact product design, gentle warm white LED ring glow like premium solar lighting at twilight, positioned on contemporary luxury deck, modern outdoor materials, high-end residential setting, sophisticated dusk lighting accent, no people',
            'description': 'Modern deck test - unchanged design with twilight LED'
        }
    ]
    
    print("🧪 Generating SIMPLE WasteWell test shots...")
    print(f"📁 Outputs will be saved to: {output_dir}")
    
    for scenario in test_scenarios:
        print(f"\n🎨 Generating: {scenario['description']}")
        
        try:
            task = client.text_to_image.create(
                model='gen4_image',
                ratio='1920:1080',
                prompt_text=scenario['prompt'],
                reference_images=wastewell_ref
            ).wait_for_task_output()
            
            print(f"✅ Task complete: {scenario['name']}")
            
            if task.output and len(task.output) > 0:
                image_url = task.output[0]
                print(f"🖼️  Image URL: {image_url}")
                
                output_file = output_dir / f"{scenario['name']}.jpg"
                if download_image(image_url, output_file):
                    print(f"💾 Saved to: {output_file}")
                
            else:
                print(f"❌ No output generated for {scenario['name']}")
                
        except TaskFailedError as e:
            print(f"❌ Generation failed for {scenario['name']}")
            print(f"   Error: {e.task_details}")
        except Exception as e:
            print(f"❌ Unexpected error for {scenario['name']}: {e}")
    
def create_additional_wastewell_hero_shots():
    """Generate additional hero shots using WasteWell2-6 reference images"""
    
    client = setup_runway_client()
    if not client:
        return
    
    # Create output directory
    output_dir = Path("runway_outputs/additional_heroes")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Additional WasteWell reference configurations
    additional_scenarios = [
        {
            'name': 'components_luxury_showcase',
            'reference': [{'uri': 'https://yardura.com/WasteWell2.png', 'tag': 'WasteWell2'}],
            'prompt': '@WasteWell2 exactly as shown in reference, no design modifications, soft warm white LED glow if visible like elegant solar lighting, positioned in upscale residential outdoor space, modern patio setting, premium stone surfaces, gentle twilight illumination, no people',
            'description': 'Component showcase - luxury setting with soft solar LED'
        },
        {
            'name': 'installation_elegant_context',
            'reference': [{'uri': 'https://yardura.com/WasteWell3.png', 'tag': 'WasteWell3'}],
            'prompt': '@WasteWell3 identical to reference design, original specifications preserved, subtle warm white LED halo like premium solar garden light at dusk, elegant installation in premium residential backyard, beautiful landscaping, upscale outdoor environment, soft evening glow accent lighting, no people',
            'description': 'Installation view - elegant context with solar glow'
        },
        {
            'name': 'dolly_system_premium_deck',
            'reference': [{'uri': 'https://yardura.com/WasteWell5.png', 'tag': 'WasteWell5'}],
            'prompt': '@WasteWell5 as shown in reference without changes, exact product design, gentle warm white LED ring glow like sophisticated solar lighting at twilight, positioned on luxury outdoor deck, contemporary materials, high-end residential setting, sophisticated outdoor space, elegant dusk lighting accent, no people',
            'description': 'Dolly system - premium deck with twilight LED'
        },
        {
            'name': 'complete_system_garden_setting',
            'reference': [{'uri': 'https://yardura.com/WasteWell6.png', 'tag': 'WasteWell6'}],
            'prompt': '@WasteWell6 precisely as shown in reference, maintaining all original details, soft warm white LED glow around halo ring like premium solar lighting, naturally positioned in beautiful residential garden, lush landscaping, premium outdoor design, gentle twilight halo illumination, no people',
            'description': 'Complete system - garden setting with solar LED'
        },
        {
            'name': 'components_modern_poolside',
            'reference': [{'uri': 'https://yardura.com/WasteWell2.png', 'tag': 'WasteWell2'}],
            'prompt': '@WasteWell2 exactly as depicted in reference, preserving exact appearance, soft warm white LED glow if visible like elegant solar lighting, positioned near luxury swimming pool area, modern outdoor design, upscale residential pool deck, gentle evening illumination, no people',
            'description': 'Components - modern poolside with solar LED'
        },
        {
            'name': 'dolly_mobility_patio',
            'reference': [{'uri': 'https://yardura.com/WasteWell5.png', 'tag': 'WasteWell5'}],
            'prompt': '@WasteWell5 true to reference specifications, unchanged design integrity, gentle warm white LED ring glow like premium solar lighting at twilight, positioned on contemporary luxury patio, modern outdoor furniture, premium residential setting, sophisticated dusk lighting accent, no people',
            'description': 'Dolly mobility - luxury patio with twilight LED'
        }
    ]
    
    print("🎨 Generating ADDITIONAL WasteWell hero shots...")
    print(f"📁 Outputs will be saved to: {output_dir}")
    print(f"🖼️  Using WasteWell2, WasteWell3, WasteWell5, WasteWell6 references")
    
    for scenario in additional_scenarios:
        print(f"\n🎨 Generating: {scenario['description']}")
        
        try:
            task = client.text_to_image.create(
                model='gen4_image',
                ratio='1920:1080',
                prompt_text=scenario['prompt'],
                reference_images=scenario['reference']
            ).wait_for_task_output()
            
            print(f"✅ Task complete: {scenario['name']}")
            
            if task.output and len(task.output) > 0:
                image_url = task.output[0]
                print(f"🖼️  Image URL: {image_url}")
                
                output_file = output_dir / f"{scenario['name']}.jpg"
                if download_image(image_url, output_file):
                    print(f"💾 Saved to: {output_file}")
                
            else:
                print(f"❌ No output generated for {scenario['name']}")
                
        except TaskFailedError as e:
            print(f"❌ Generation failed for {scenario['name']}")
            print(f"   Error: {e.task_details}")
        except Exception as e:
            print(f"❌ Unexpected error for {scenario['name']}: {e}")

def test_runway_connection():
    """Test if Runway API connection works"""
    client = setup_runway_client()
    if not client:
        return False
    
    print("🔑 Testing Runway API connection...")
    
    try:
        task = client.text_to_image.create(
            model='gen4_image',
            ratio='1024:1024',
            prompt_text='A simple test image of a modern outdoor waste bin in a backyard setting'
        ).wait_for_task_output()
        
        print("✅ Runway API connection successful!")
        print(f"🖼️  Test image URL: {task.output[0] if task.output else 'No output'}")
        return True
        
    except TaskFailedError as e:
        print(f"❌ Runway API test failed: {e.task_details}")
        return False
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False

if __name__ == "__main__":
    print("🎭 Runway WasteWell Design-Fidelity Hero Generator")
    print("=" * 65)
    print("🔒 Following Gen-4 best practices: Single reference images for exact design consistency")
    
    # First test the connection
    if test_runway_connection():
        print("\n🧪 Starting with simple test shots...")
        
        # Generate simple test shots first
        create_simple_wastewell_test()
        
        print("\n🎨 Generating additional hero shots with different reference images...")
        
        # Generate additional hero shots using other reference images
        create_additional_wastewell_hero_shots()
        
        print("\n🎉 All WasteWell hero generation complete!")
        print("📁 Check runway_outputs/ directories:")
        print("   • runway_outputs/simple_test/ - Basic hero shots")
        print("   • runway_outputs/additional_heroes/ - Extended collection")
        
    else:
        print("\n📋 Setup Instructions:")
        print("1. Install Runway SDK: pip install runwayml")
        print("2. Get API key from: https://app.runwayml.com/")
        print("3. Add RUNWAY_API_KEY to your .env file")
        print("4. WasteWell reference images hosted at yardura.com")
        print("5. Run script for design-consistent hero shots") 