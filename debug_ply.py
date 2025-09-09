#!/usr/bin/env python3
"""Debug script to examine PLY file structure"""

from plyfile import PlyData
import numpy as np

try:
    print("Loading PLY file...")
    plydata = PlyData.read("markmate_files/merged_gs (1).ply")
    
    print(f"PLY elements: {[element.name for element in plydata.elements]}")
    
    for element in plydata.elements:
        print(f"\nElement: {element.name}")
        print(f"Count: {element.count}")
        if hasattr(element, 'data'):
            print(f"Data type: {type(element.data)}")
            if hasattr(element.data, 'dtype'):
                print(f"Dtype: {element.data.dtype}")
                print(f"Field names: {element.data.dtype.names}")
        
    vertex_data = plydata['vertex'].data
    print(f"\nVertex data shape: {vertex_data.shape}")
    print(f"First vertex: {vertex_data[0]}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc() 