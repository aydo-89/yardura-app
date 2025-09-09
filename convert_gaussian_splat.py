#!/usr/bin/env python3
"""
Convert Gaussian Splat PLY to GLB with preserved colors and materials
"""

import numpy as np
import trimesh
from plyfile import PlyData
import tempfile
import os

def convert_gaussian_splat_to_glb(input_file, output_file):
    """Convert Gaussian splat PLY to GLB with color preservation"""
    
    print(f"Loading Gaussian splat from: {input_file}")
    
    # Read PLY file
    plydata = PlyData.read(input_file)
    vertex_data = plydata['vertex'].data
    
    # Extract coordinates
    vertices = np.column_stack([
        vertex_data['x'],
        vertex_data['y'], 
        vertex_data['z']
    ])
    
    # Extract colors from spherical harmonics coefficients
    vertex_colors = None
    field_names = vertex_data.dtype.names
    print(f"Available fields: {field_names}")
    
    if all(prop in field_names for prop in ['f_dc_0', 'f_dc_1', 'f_dc_2']):
        # Convert spherical harmonics DC coefficients to RGB
        # The DC component of spherical harmonics represents the base color
        SH_C0 = 0.28209479177387814  # sqrt(1/(4*pi))
        
        sh_dc = np.column_stack([
            vertex_data['f_dc_0'],
            vertex_data['f_dc_1'],
            vertex_data['f_dc_2']
        ])
        
        # Convert SH to RGB
        colors_sh = sh_dc * SH_C0 + 0.5
        
        # Clamp to valid RGB range
        vertex_colors = np.clip(colors_sh, 0.0, 1.0)
        print(f"Converted spherical harmonics to RGB colors for {len(vertex_colors)} vertices")
        
    elif all(prop in field_names for prop in ['red', 'green', 'blue']):
        vertex_colors = np.column_stack([
            vertex_data['red'],
            vertex_data['green'],
            vertex_data['blue']
        ]) / 255.0  # Normalize to 0-1
        print(f"Found RGB colors for {len(vertex_colors)} vertices")
    else:
        print("No color information found in PLY file")
    
    print(f"Processing {len(vertices)} vertices...")
    
    # Create a more detailed mesh using Delaunay triangulation
    try:
        from scipy.spatial import ConvexHull
        # Use ConvexHull for better surface reconstruction
        hull = ConvexHull(vertices)
        faces = hull.simplices
        hull_vertices = vertices[hull.vertices]
        
        # Create mesh
        mesh = trimesh.Trimesh(vertices=hull_vertices, faces=faces)
        
        # Add vertex colors if available
        if vertex_colors is not None:
            hull_colors = vertex_colors[hull.vertices]
            mesh.visual.vertex_colors = (hull_colors * 255).astype(np.uint8)
            print("Applied vertex colors to mesh")
        
    except Exception as e:
        print(f"Advanced meshing failed: {e}")
        # Fallback to basic point cloud meshing
        mesh = trimesh.points.PointCloud(vertices)
        if vertex_colors is not None:
            mesh.colors = (vertex_colors * 255).astype(np.uint8)
        mesh = mesh.convex_hull
    
    # Scale and center
    mesh.apply_scale(0.01)  # Scale down
    mesh.apply_translation(-mesh.centroid)  # Center
    
    # Export with material preservation
    print(f"Exporting to: {output_file}")
    mesh.export(output_file, file_type='glb')
    
    file_size = os.path.getsize(output_file) / (1024 * 1024)  # MB
    print(f"✅ Export complete: {file_size:.2f} MB")
    print(f"   Vertices: {len(mesh.vertices)}")
    print(f"   Faces: {len(mesh.faces)}")
    
    return mesh

if __name__ == "__main__":
    input_file = "markmate_files/merged_gs (1).ply"
    output_file = "public/markmate_gaussian_preserved.glb"
    
    try:
        mesh = convert_gaussian_splat_to_glb(input_file, output_file)
        print("\n🎉 Gaussian splat conversion complete!")
        print("This version should preserve more color information.")
    except Exception as e:
        print(f"❌ Conversion failed: {e}")
        print("You may need to install: pip install plyfile scipy") 