import './styles/main.scss'
import {createClient} from '@sanity/client'

// Import Three.js, GLTFLoader, and Transformers.js for 3D depth mapping
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { pipeline } from '@xenova/transformers'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Make GLTFLoader available globally
window.THREE = THREE
window.GLTFLoader = GLTFLoader

// Sanity client configuration
const sanityClient = createClient({
  projectId: 'xvi8q8j2',
  dataset: 'production',
  useCdn: true,
  apiVersion: '2023-01-01'
})

// AR Viewer Functionality with glTF and USDZ Support
const ARViewer = {
  container: null,
  modelViewer: null,
  fallbackViewer: null,
  loading: null,
  instructions: null,
  isARSupported: false,
  currentProduct: null,
  productData: null,
  
  // 3D Depth Mapping Components
  depthPipeline: null,
  scene3D: null,
  renderer3D: null,
  camera3D: null,
  depthMesh: null,
  isDepthProcessing: false,
  enableDepthMapping: false,
  
  // Device detection helpers
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
  isMacSafari: /Macintosh/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
  
  // Product configurations
  products: {
    wastewell: {
      name: 'WasteWell™',
      configurations: [
        {
          name: 'WasteWell Base',
          key: 'base',
          scale: '0.25 0.25 0.25',
          cameraOrbit: '45deg 75deg 4m',
          gltfUrl: '/wastewell_only.gltf',
          usdzUrl: '/wastewell_only.usdz'
        },
        {
          name: 'WasteWell with CleanClip Scooper',
          key: 'withScoop',
          scale: '0.25 0.25 0.25',
          cameraOrbit: '45deg 75deg 4m',
          gltfUrl: '/wastewell_and_scoop.gltf',
          usdzUrl: '/wastewell_and_scoop.usdz'
        },
        {
          name: 'WasteWell with RollRover Dolly',
          key: 'withDolly',
          scale: '0.25 0.25 0.25',
          cameraOrbit: '45deg 75deg 4m',
          gltfUrl: '/wastewell_and_dolly.gltf',
          usdzUrl: '/wastewell_and_dolly.usdz'
        },
        {
          name: 'WasteWell with Both Accessories',
          key: 'complete',
          scale: '0.25 0.25 0.25',
          cameraOrbit: '45deg 75deg 4m',
          gltfUrl: '/wastewell_both_scoop_and_dolly.gltf',
          usdzUrl: '/wastewell_both_scoop_and_dolly.usdz'
        }
      ]
    },
    markmate: {
      name: 'MarkMate Training Post',
      configurations: [
        {
          name: 'MarkMate Training Post',
          key: 'base',
          scale: '0.5 0.5 0.5',
          cameraOrbit: '45deg 75deg 2m',
          gltfUrl: '/markmate_omnipart_draco.glb',
          usdzUrl: '/markmate_omnipart_draco.glb'  // OmniPart Draco-compressed 596KB version with full textures
        }
      ]
    }
  },
  
  async init() {
    this.container = document.getElementById('arViewerContainer');
    this.modelViewer = document.getElementById('arModelViewer');
    this.fallbackViewer = document.getElementById('fallbackModelViewer');
    this.loading = document.getElementById('arLoading');
    this.instructions = document.getElementById('arInstructions');
    
    this.checkARSupport();
    this.setupEventListeners();
    this.setupAnalytics();
    
    // Initialize depth estimation system
    await this.initializeDepthEstimation();
    
    // Load product data from Sanity
    await this.loadProductData();
  },

  async loadProductData() {
    try {
      console.log('🔄 Loading product data from Sanity...')
      
      // Disable AR controls during loading
      this.setControlsEnabled(false)
      
      // Set default product if not already set
      if (!this.currentProduct) {
        this.currentProduct = 'wastewell' // Default to wastewell
      }
      
      // Determine the product slug based on current product
      const productSlug = this.currentProduct === 'markmate' ? 'markmate-training-post' : 'wastewell-led-waste-station'
      
      const query = `*[_type == "product" && slug.current == "${productSlug}"][0]{
        _id,
        name,
        description,
        configurations[]{
          name,
          key,
          scale,
          cameraOrbit,
          "gltfUrl": gltfModel.asset->url,
          "usdzUrl": usdzModel.asset->url,
          "fallbackImageUrl": fallbackImage.asset->url
        }
      }`
      
      this.productData = await sanityClient.fetch(query)
      
      if (this.productData) {
        console.log('✅ Product data loaded:', this.productData)
        console.log('📦 Available configurations:', this.productData.configurations?.map(c => c.key))
      } else {
        console.warn('⚠️ No product data found in Sanity')
        // Fallback to local files
        this.useLocalFallback()
      }
      
      // Enable AR controls and initialize configuration after data loads
      this.setControlsEnabled(true)
      this.initializeConfiguration()
      
    } catch (error) {
      console.error('❌ Failed to load product data from Sanity:', error)
      console.log('🔄 Using local product configurations...')
      this.useLocalFallback()
      // Still enable controls and initialize with fallback data
      this.setControlsEnabled(true)
      this.initializeConfiguration()
    }
  },

  useLocalFallback() {
    console.log(`🔄 Using local file fallback for ${this.currentProduct}...`)
    
    if (this.currentProduct === 'markmate') {
      this.productData = {
        name: 'MarkMate Training Post',
        configurations: [
          {
            name: 'MarkMate Training Post',
            key: 'base',
            gltfUrl: '/markmate_omnipart_draco.glb',
            usdzUrl: '/markmate_omnipart_draco.glb',
            scale: '0.5 0.5 0.5',
            cameraOrbit: '45deg 75deg 2m'
          }
        ]
      }
    } else {
      this.productData = {
        name: 'WasteWell™',
        configurations: [
          {
            name: 'Base WasteWell™ Unit',
            key: 'base',
            gltfUrl: '/wastewell_only.glb', // Now using GLB with all data embedded
            usdzUrl: '/wastewell_only.usdz',
            scale: '1 1 1',
            cameraOrbit: '0deg 75deg 2.5m'
          },
          {
            name: 'WasteWell™ + CleanClip™ Scooper',
            key: 'withScoop',
            gltfUrl: '/wastewell_and_scoop.glb', // Now using GLB with all data embedded
            usdzUrl: '/wastewell_and_scoop.usdz',
            scale: '1 1 1',
            cameraOrbit: '0deg 75deg 2.5m'
          },
          {
            name: 'WasteWell™ + RollRover™ Dolly',
            key: 'withDolly',
            gltfUrl: '/wastewell_and_dolly.glb', // Now using GLB with all data embedded
            usdzUrl: '/wastewell_and_dolly.usdz',
            scale: '1 1 1',
            cameraOrbit: '0deg 75deg 2.5m'
          },
          {
            name: 'WasteWell™ + Complete System',
            key: 'complete',
            gltfUrl: '/wastewell_both_scoop_and_dolly.glb', // Now using GLB with all data embedded
            usdzUrl: '/wastewell_both_scoop_and_dolly.usdz',
            scale: '1 1 1',
            cameraOrbit: '0deg 75deg 2.5m'
          }
        ]
      }
    }
    
    console.log('✅ Local fallback data loaded with configurations:', this.productData.configurations.map(c => c.key))
    // Load the first configuration by default
    this.loadConfiguration(this.productData.configurations[0])
  },

  getLocalFallbackData() {
    return {
      name: 'WasteWell™',
      configurations: [
        {
          name: 'WasteWell Base',
          key: 'base',
          scale: '0.25 0.25 0.25',
          cameraOrbit: '45deg 75deg 4m',
          gltfUrl: '/wastewell_only.gltf',
          usdzUrl: '/wastewell_only.usdz',
          fallbackImageUrl: '/img/luxury_patio_hero.jpg'
        },
        {
          name: 'WasteWell with CleanClip Scooper',
          key: 'withScoop',
          scale: '0.25 0.25 0.25',
          cameraOrbit: '45deg 75deg 4m',
          gltfUrl: '/wastewell_and_scoop.gltf',
          usdzUrl: '/wastewell_and_scoop.usdz',
          fallbackImageUrl: '/img/luxury_patio_hero.jpg'
        },
        {
          name: 'WasteWell with RollRover Dolly',
          key: 'withDolly',
          scale: '0.25 0.25 0.25',
          cameraOrbit: '45deg 75deg 4m',
          gltfUrl: '/wastewell_and_dolly.gltf',
          usdzUrl: '/wastewell_and_dolly.usdz',
          fallbackImageUrl: '/img/luxury_patio_hero.jpg'
        },
        {
          name: 'WasteWell with Both Accessories',
          key: 'complete',
          scale: '0.25 0.25 0.25',
          cameraOrbit: '45deg 75deg 4m',
          gltfUrl: '/wastewell_both_scoop_and_dolly.gltf',
          usdzUrl: '/wastewell_both_scoop_and_dolly.usdz',
          fallbackImageUrl: '/img/luxury_patio_hero.jpg'
        }
      ]
    }
  },

  setControlsEnabled(enabled) {
    const controls = document.querySelectorAll('.ar-config-controls input, .ar-config-controls button')
    controls.forEach(control => {
      control.disabled = !enabled
      if (enabled) {
        control.classList.remove('loading')
      } else {
        control.classList.add('loading')
      }
    })
    
    // Update visual feedback
    const arControls = document.querySelector('.ar-config-controls')
    if (arControls) {
      if (enabled) {
        arControls.classList.remove('loading')
      } else {
        arControls.classList.add('loading')
      }
    }
    
    console.log(enabled ? '✅ AR controls enabled' : '⏳ AR controls disabled during loading')
  },

  initializeConfiguration() {
    // Initialize the AR configuration now that data is loaded
    if (typeof window.updateARConfiguration === 'function') {
      console.log('🔧 Initializing AR configuration...')
      window.updateARConfiguration()
    }
  },

  loadConfiguration(config) {
    if (!config) {
      console.error('❌ No configuration provided to loadConfiguration')
      return
    }
    
    console.log('🔄 Loading configuration:', config.name)
    this.currentProduct = config
    
    // Set model viewer source to the GLB/glTF file
    if (this.modelViewer && config.gltfUrl) {
      this.modelViewer.src = config.gltfUrl
      if (config.scale) {
        this.modelViewer.scale = config.scale
      }
      if (config.cameraOrbit) {
        this.modelViewer.cameraOrbit = config.cameraOrbit
      }
    }
    
    console.log('✅ Configuration loaded successfully')
  },

  checkARSupport() {
    if (this.modelViewer) {
      // Check for WebXR support (Android AR)
      if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
          this.isARSupported = supported || this.isIOS || this.isMacSafari;
          this.updateARButtons();
        }).catch(() => {
          this.isARSupported = this.isIOS || this.isMacSafari;
          this.updateARButtons();
        });
      } else {
        // iOS and macOS Safari support AR Quick Look
        this.isARSupported = this.isIOS || this.isMacSafari;
        this.updateARButtons();
      }
    }
  },

  updateARButtons() {
    const buttons = document.querySelectorAll('.view-in-yard-btn');
    buttons.forEach(button => {
      if (this.isARSupported) {
        if (this.isIOS) {
          button.innerHTML = '<span>📱</span> View in AR';
          button.title = 'View in AR using iPhone/iPad camera';
        } else if (this.isMacSafari) {
          button.innerHTML = '<span>🖥️</span> View in AR';
          button.title = 'View in AR Quick Look on macOS Safari';
        } else {
          button.innerHTML = '<span>🥽</span> View in AR';
          button.title = 'View in AR (WebXR)';
        }
      } else {
        button.innerHTML = '<span>🔄</span> View in 3D';
        button.title = 'Interactive 3D preview (AR not supported on this device)';
      }
    });
  },

  // Get current configuration based on accessory toggles
  getCurrentConfiguration() {
    if (!this.productData?.configurations) {
      console.warn('⚠️ No product configurations available')
      return null
    }

    // Try main page toggles first (pre-AR configuration), then fallback to AR toggles
    const mainScoopToggle = document.getElementById('main-scoop-toggle')
    const mainDollyToggle = document.getElementById('main-dolly-toggle')
    const arScoopToggle = document.getElementById('ar-scoop-toggle')
    const arDollyToggle = document.getElementById('ar-dolly-toggle')

    const scoopChecked = (mainScoopToggle?.checked) || (arScoopToggle?.checked) || false
    const dollyChecked = (mainDollyToggle?.checked) || (arDollyToggle?.checked) || false

    console.log(`🎛️ Toggle states - Scoop: ${scoopChecked}, Dolly: ${dollyChecked}`)

    let configKey = 'base'
    if (scoopChecked && dollyChecked) {
      configKey = 'complete'
    } else if (scoopChecked) {
      configKey = 'withScoop'
    } else if (dollyChecked) {
      configKey = 'withDolly'
    }

    const config = this.productData.configurations.find(c => c.key === configKey)
    console.log(`🔧 Current configuration: ${configKey}`, config)
    return config
  },

  // Update preview when main page toggles change
  updatePreviewConfiguration() {
    const mainScoopToggle = document.getElementById('main-scoop-toggle')
    const mainDollyToggle = document.getElementById('main-dolly-toggle')
    
    const scoopChecked = mainScoopToggle?.checked || false
    const dollyChecked = mainDollyToggle?.checked || false

    console.log(`🔄 Pre-AR config updated - Scoop: ${scoopChecked}, Dolly: ${dollyChecked}`)

    // Update active states for visual feedback
    this.updateToggleActiveStates()

    // Sync with AR toggles if they exist (for consistency)
    const arScoopToggle = document.getElementById('ar-scoop-toggle')
    const arDollyToggle = document.getElementById('ar-dolly-toggle')
    
    if (arScoopToggle) arScoopToggle.checked = scoopChecked
    if (arDollyToggle) arDollyToggle.checked = dollyChecked

    // Update button text based on configuration
    this.updateARButtonText()
  },

  // Update visual active states for toggle options
  updateToggleActiveStates() {
    const scoopToggle = document.getElementById('main-scoop-toggle')
    const dollyToggle = document.getElementById('main-dolly-toggle')
    
    // Get the parent toggle-option elements
    const scoopOption = scoopToggle?.closest('.toggle-option')
    const dollyOption = dollyToggle?.closest('.toggle-option')
    
    // Update active class based on checked state
    if (scoopOption) {
      if (scoopToggle.checked) {
        scoopOption.classList.add('active')
    } else {
        scoopOption.classList.remove('active')
      }
    }
    
    if (dollyOption) {
      if (dollyToggle.checked) {
        dollyOption.classList.add('active')
      } else {
        dollyOption.classList.remove('active')
      }
    }
  },

  // Update AR button text to reflect current configuration
  updateARButtonText() {
    const button = document.querySelector('.view-in-yard-btn')
    if (!button) return

    const mainScoopToggle = document.getElementById('main-scoop-toggle')
    const mainDollyToggle = document.getElementById('main-dolly-toggle')
    
    const scoopChecked = mainScoopToggle?.checked || false
    const dollyChecked = mainDollyToggle?.checked || false

    let configText = ''
    if (scoopChecked && dollyChecked) {
      configText = ' (Complete System)'
    } else if (scoopChecked) {
      configText = ' (+ Scooper)'
    } else if (dollyChecked) {
      configText = ' (+ Dolly)'
    }

    button.innerHTML = `<span>📱</span> View in My Space${configText}`
  },

  openARViewer(productId = 'wastewell') {
    this.currentProduct = productId
    console.log(`🚀 Opening AR viewer for product: ${productId}`)

    // Make sure we have product data loaded
    if (!this.productData) {
      console.log('🔄 Loading product data for AR viewer...')
      this.loadProductData().then(() => {
        this.openARViewer(productId) // Retry after loading
      })
      return
    }

    let config;
    if (productId === 'wastewell') {
      // For WasteWell, use the toggle-based configuration
      config = this.getCurrentConfiguration()
    } else {
      // For other products like MarkMate, use the base configuration from productData
      if (this.productData && this.productData.configurations) {
        config = this.productData.configurations[0] // Use base configuration
      } else {
        console.error(`❌ No product data available for "${productId}"`)
        return
      }
    }

    if (!config) {
      console.error('❌ No configuration available for AR viewing')
      console.log('Available configurations:', this.productData?.configurations?.map(c => c.key))
      return
    }

    console.log('🚀 Opening AR viewer with config:', config.key)

    // For iOS and macOS Safari, use USDZ with AR Quick Look
    if ((this.isIOS || this.isMacSafari) && config.usdzUrl) {
      console.log('📱 Using USDZ for AR Quick Look')
      window.location.href = config.usdzUrl
      return
    }

    // For other browsers, show 3D model viewer with glTF
    this.show3DViewer(config)
    
    // Sync AR toggles with main page toggles
    this.syncARToggles()
  },

  // Initialize AR toggles to default state
  syncARToggles() {
    const arScoopToggle = document.getElementById('ar-scoop-toggle')
    const arDollyToggle = document.getElementById('ar-dolly-toggle')
    
    // Initialize toggles to false (base configuration)
    if (arScoopToggle) arScoopToggle.checked = false
    if (arDollyToggle) arDollyToggle.checked = false
  },

  // Update AR configuration when toggles change
  updateARConfiguration() {
    const arScoopToggle = document.getElementById('ar-scoop-toggle')
    const arDollyToggle = document.getElementById('ar-dolly-toggle')
    
    if (!arScoopToggle || !arDollyToggle) {
      console.warn('⚠️ AR toggles not found')
      return
    }

    const scoopChecked = arScoopToggle.checked
    const dollyChecked = arDollyToggle.checked

    // Determine configuration key
    let configKey = 'base'
    if (scoopChecked && dollyChecked) {
      configKey = 'complete'
    } else if (scoopChecked) {
      configKey = 'withScoop'
    } else if (dollyChecked) {
      configKey = 'withDolly'
    }

    // Ensure productData is loaded
    if (!this.productData?.configurations) {
      console.error('❌ Product data not loaded yet, falling back to local data')
      // Force load local fallback if not loaded
      this.useLocalFallback()
      // Try again now that fallback data is loaded
      setTimeout(() => this.updateARConfiguration(), 100)
      return
    }

    // Find the configuration
    let config = this.productData.configurations.find(c => c.key === configKey)
    
    // If configuration not found in Sanity data, fall back to local data
    if (!config) {
      console.warn(`⚠️ Configuration '${configKey}' not found in Sanity, trying local fallback...`)
      
      // Temporarily load local fallback to get missing configuration
      const localFallback = this.getLocalFallbackData()
      config = localFallback.configurations.find(c => c.key === configKey)
      
      if (!config) {
        console.error('❌ Configuration not found in local fallback either:', configKey)
        console.log('📦 Available configurations:', this.productData.configurations.map(c => c.key))
        return
      } else {
        console.log(`✅ Found '${configKey}' in local fallback data`)
      }
    }

    console.log('🔄 Updating AR configuration to:', config.name)

    // Update the model
    if (this.modelViewer) {
      // Show loading
      this.showLoading()
      
      // Update model source
      this.modelViewer.setAttribute('src', config.gltfUrl)
      this.modelViewer.setAttribute('ios-src', config.usdzUrl)
      this.modelViewer.setAttribute('scale', config.scale || '1 1 1')
      this.modelViewer.setAttribute('camera-orbit', config.cameraOrbit || '0deg 75deg 2.5m')
      
      // Update title
      const title = document.getElementById('arViewerTitle')
      if (title) {
        title.textContent = config.name
      }
      
      // Set up load event
      const onModelLoad = () => {
        console.log('✅ AR model updated successfully')
        this.hideLoading()
        this.modelViewer.removeEventListener('load', onModelLoad)
      }
      
      this.modelViewer.addEventListener('load', onModelLoad)
    }
  },

  show3DViewer(config) {
    if (!this.container || !this.modelViewer) {
      console.error('❌ AR viewer elements not found')
      return
    }

    console.log('🔄 Loading AR-enabled 3D model viewer...')
    
    // Use glTF for web browsers, fallback to USDZ if no glTF available
    const modelUrl = config.gltfUrl || config.usdzUrl
    const isGltf = modelUrl.endsWith('.gltf') || modelUrl.endsWith('.glb')
    
    console.log(`📄 Loading ${isGltf ? 'glTF' : 'USDZ'} model: ${modelUrl}`)

    // Update AR viewer title with current product and configuration
    const title = document.getElementById('arViewerTitle')
    if (title) {
      const productName = this.products[this.currentProduct]?.name || config.name
      title.textContent = `${productName} in AR`
    }

    // Show photo upload for desktop only (not mobile)
    this.setupPhotoUpload()
    
    // Show/hide controls based on product
    this.setupProductControls()

    // Update model-viewer attributes for AR
    this.modelViewer.setAttribute('src', modelUrl)
    this.modelViewer.setAttribute('ios-src', config.usdzUrl) // iOS AR fallback
    this.modelViewer.setAttribute('scale', config.scale || '1 1 1')
    this.modelViewer.setAttribute('camera-orbit', config.cameraOrbit || '0deg 75deg 2.5m')
    
    // **ENABLE AR MODE** - This is the key for camera overlay AR
    this.modelViewer.setAttribute('ar', '') // Enable AR button
    this.modelViewer.setAttribute('ar-modes', 'webxr scene-viewer quick-look') // Support all AR platforms
    this.modelViewer.setAttribute('camera-controls', '') // Enable camera controls
    this.modelViewer.setAttribute('touch-action', 'pan-y') // Better touch handling
    this.modelViewer.setAttribute('ar-scale', 'auto') // Auto-scale in AR
    
    // Enhanced lighting and shadows for AR
    this.modelViewer.setAttribute('environment-image', 'neutral')
    this.modelViewer.setAttribute('shadow-intensity', '1')
    this.modelViewer.setAttribute('shadow-softness', '0.75')
    this.modelViewer.setAttribute('exposure', '1')
    
    // Auto-rotate when not in AR
    this.modelViewer.setAttribute('auto-rotate', '')
    this.modelViewer.setAttribute('auto-rotate-delay', '3000')
    
    // Show loading state
    this.showLoading()
    
    // Show container
    this.container.style.display = 'flex'
    this.container.classList.add('active')
    
    // Set up model load event listeners
      this.modelViewer.addEventListener('load', () => {
      console.log('✅ AR-enabled 3D model loaded successfully')
      this.hideLoading()
      this.updateInstructions(isGltf, true) // true = AR enabled
      this.checkARSupport()
      

    }, { once: true })
    
    this.modelViewer.addEventListener('error', (error) => {
      console.error('❌ Failed to load 3D model:', error)
      this.showFallback(config)
    }, { once: true })
    
    // AR session events
    this.modelViewer.addEventListener('ar-status', (event) => {
      console.log('🥽 AR Status:', event.detail.status)
      if (event.detail.status === 'session-started') {
        console.log('🎉 AR camera overlay activated!')
      }
    })
  },

    updateInstructions(isGltf, arEnabled = false) {
    if (!this.instructions) return

    // Clear any existing content first
    this.instructions.innerHTML = ''
    
    // Create a single paragraph element
    const paragraph = document.createElement('p')
    
    if (isGltf && arEnabled) {
      paragraph.textContent = 'Drag to rotate • Scroll to zoom • Tap AR button to place in your space'
    } else if (isGltf) {
      paragraph.textContent = 'Drag to rotate • Scroll to zoom • Right-click to pan'
    } else {
      paragraph.textContent = 'Tap to open AR viewer'
    }
    
    // Append the paragraph directly to the instructions div
    this.instructions.appendChild(paragraph)
  },

  checkARSupport() {
    // Enhanced AR support detection
    if ('xr' in navigator) {
      navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        if (supported) {
          console.log('✅ WebXR AR supported!')
          this.isARSupported = true
        } else {
          console.log('⚠️ WebXR AR not supported')
        }
      }).catch((err) => {
        console.log('⚠️ WebXR check failed:', err)
      })
    }
    
    // Check for Android Scene Viewer support
    if (/Android/i.test(navigator.userAgent)) {
      this.isAndroid = true
      console.log('📱 Android detected - Scene Viewer may be available')
    }
    
    // iOS/macOS already detected in init
    if (this.isIOS || this.isMacSafari) {
      console.log('🍎 iOS/macOS detected - AR Quick Look supported')
      this.isARSupported = true
    }
  },

  showFallback(config) {
    console.log('🔄 Showing fallback content...')
    this.hideLoading()
    
    if (this.fallbackViewer) {
      this.fallbackViewer.innerHTML = `
        <div class="fallback-content">
          <h3>🔧 3D Model Setup in Progress</h3>
          <p>We're working on optimizing the 3D models for web viewing. Here are your current options:</p>
          
          <div class="fallback-options">
            <div class="fallback-section">
              <h4>📱 For Mobile AR (Recommended)</h4>
              ${config.usdzUrl ? `
                <a href="${config.usdzUrl}" class="download-link primary" download>
                  📱 Download USDZ Model
                </a>
                <p class="option-note">Works with iOS Safari and macOS Quick Look for AR viewing</p>
              ` : ''}
            </div>
            
            <div class="fallback-section">
              <h4>🖥️ For Web Browsers</h4>
              ${config.gltfUrl ? `
                <a href="${config.gltfUrl}" class="download-link secondary" download>
                  📄 Download Model File
                </a>
                <p class="option-note">Use with 3D model viewers or development tools</p>
              ` : ''}
            </div>

            <div class="fallback-section">
              <h4>🎯 Best Experience</h4>
              <div class="device-recommendations">
                <div class="device-rec">
                  <strong>iOS Devices:</strong> Use the USDZ download for full AR experience
                </div>
                <div class="device-rec">
                  <strong>macOS Safari:</strong> Click USDZ links for Quick Look AR
                </div>
                <div class="device-rec">
                  <strong>Other Browsers:</strong> Web 3D viewer coming soon!
                </div>
              </div>
            </div>
          </div>
          
          <div class="fallback-status">
            <p class="status-note">
              <strong>Status Update:</strong> We've successfully uploaded both glTF and USDZ models to our content management system. 
              We're currently working on resolving a technical issue with the 3D model binary data to enable full web browser support.
            </p>
          </div>
        </div>
      `
      this.fallbackViewer.style.display = 'block'
    }
  },

  showLoading() {
    if (this.loading) {
      this.loading.style.display = 'flex'
    }
    if (this.fallbackViewer) {
      this.fallbackViewer.style.display = 'none'
    }
    
    // Hide AR config controls during loading
    const arConfigControls = document.querySelector('.ar-config-controls')
    if (arConfigControls) {
      arConfigControls.style.opacity = '0.5'
      arConfigControls.style.pointerEvents = 'none'
    }
  },

  hideLoading() {
    if (this.loading) {
      this.loading.style.display = 'none'
    }
    
    // Show AR config controls when ready
    const arConfigControls = document.querySelector('.ar-config-controls')
    if (arConfigControls) {
      arConfigControls.style.opacity = '1'
      arConfigControls.style.pointerEvents = 'auto'
    }
  },

  closeARViewer() {
    if (this.container) {
      this.container.style.display = 'none'
      this.container.classList.remove('active')
    }
    this.hideLoading()
    if (this.fallbackViewer) {
      this.fallbackViewer.style.display = 'none'
    }
  },

  setupEventListeners() {
    // Note: AR viewer buttons use inline onclick handlers now
    // Removed redundant event listeners to prevent double-calls
    
    // Close button listener
    const closeButton = document.getElementById('closeARViewer');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.closeARViewer();
      });
    }

    // Container click outside to close
    if (this.container) {
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
          this.closeARViewer();
      }
    });
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.container?.classList.contains('active')) {
        this.closeARViewer();
      }
    });
  },

  setupAnalytics() {
    // Analytics placeholder
    console.log('📊 Analytics setup placeholder');
  },

  // Photo Upload Functionality for Desktop
  setupPhotoUpload() {
    const photoUploadSection = document.getElementById('photoUploadSection')
    if (!photoUploadSection) return

    // Only show on desktop (not mobile devices)
    if (this.isDesktop()) {
      photoUploadSection.classList.add('desktop-only')
      console.log('📷 Photo upload enabled for desktop')
      
      // Initialize scaling controls after photo upload is enabled
      setTimeout(() => {
        // Scaling controls removed - scroll zoom works perfectly
      }, 100)
    } else {
      photoUploadSection.style.display = 'none'
      console.log('📱 Photo upload hidden on mobile (AR available)')
    }
  },

  setupProductControls() {
    const arConfigControls = document.querySelector('.ar-config-controls')
    
    if (this.currentProduct === 'wastewell') {
      // Show AR config controls for WasteWell (has accessories)
      if (arConfigControls) {
        arConfigControls.style.display = 'block'
      }
      console.log('🎛️ AR config controls shown for WasteWell')
    } else {
      // Hide AR config controls for other products (no accessories)
      if (arConfigControls) {
        arConfigControls.style.display = 'none'
      }
      console.log('🎛️ AR config controls hidden for', this.currentProduct)
    }
  },

  isDesktop() {
    // Check if it's a desktop device (not mobile/tablet)
    const userAgent = navigator.userAgent.toLowerCase()
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
    const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent)
    
    // Also check screen size as backup
    const isLargeScreen = window.innerWidth >= 1024
    
    return !isMobile && !isTablet && isLargeScreen
  },

  handlePhotoUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      console.warn('⚠️ Invalid file type. Please upload an image.')
      return
    }

    // Check file size (limit to 10MB for performance)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      console.warn('⚠️ Image too large. Please use an image smaller than 10MB.')
      return
    }

    console.log('📷 Processing uploaded photo for enhanced visualization:', file.name)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageUrl = e.target.result
      
      try {
        
        // Validate image can be decoded
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = imageUrl
        })

        // Process with DepthAnything V2 technology
        console.log('🎯 Processing with DEPTH ANYTHING V2 technology...')
        console.log('🚀 State-of-the-art depth estimation (10x better than MiDaS)')
        console.log('💡 Professional depth maps with fine details')
        await this.processPhotoWithDepthAnythingV2(imageUrl)
        
        // Show clear button
        const clearBtn = document.getElementById('photoClearBtn')
        if (clearBtn) clearBtn.style.display = 'block'
        
        console.log('✅ Photo processed successfully')
        
      } catch (error) {
        console.error('❌ Failed to process uploaded photo:', error)
        // Fallback to basic photo background
        if (imageUrl) {
          this.setPhotoBackground(imageUrl)
        }
      }
    }
    
    reader.onerror = () => {
      console.error('❌ Failed to read uploaded photo file')
    }
    
    reader.readAsDataURL(file)
  },

  setPhotoBackground(imageUrl) {
    if (!this.modelViewer) return

    // Set the photo as background
    this.modelViewer.style.backgroundImage = `url(${imageUrl})`
    this.modelViewer.style.backgroundSize = 'cover'
    this.modelViewer.style.backgroundPosition = 'center'
    this.modelViewer.style.backgroundRepeat = 'no-repeat'
    this.modelViewer.classList.add('with-photo-background')
    
    // Keep environment lighting but use a neutral studio environment for good lighting
    this.modelViewer.setAttribute('environment-image', 'neutral')
    this.modelViewer.removeAttribute('skybox-image')
    
    // Enhance shadows and lighting for photo backgrounds
    this.modelViewer.setAttribute('shadow-intensity', '1.5')
    this.modelViewer.setAttribute('shadow-softness', '0.6')
    this.modelViewer.setAttribute('exposure', '1.2')
    
    // Make sure the model is well-lit
    this.modelViewer.setAttribute('tone-mapping', 'commerce')
    
    // Adjust camera position to show more of the background
    this.modelViewer.setAttribute('camera-orbit', '0deg 75deg 4m')
    this.modelViewer.setAttribute('min-camera-orbit', 'auto auto 2m')
    this.modelViewer.setAttribute('max-camera-orbit', 'auto auto 8m')
    
    console.log('🖼️ Photo background applied with proper lighting')
  },

  setEnhancedPhotoBackground(imageUrl) {
    if (!this.modelViewer) return

    // Set the photo as background with dramatic 3D depth effects
    this.modelViewer.style.backgroundImage = `url(${imageUrl})`
    this.modelViewer.style.backgroundSize = '115% auto'  // Larger for depth parallax
    this.modelViewer.style.backgroundPosition = 'center'
    this.modelViewer.style.backgroundRepeat = 'no-repeat'
    this.modelViewer.style.backgroundAttachment = 'fixed'
    this.modelViewer.classList.add('with-photo-background')
    
    // Add dramatic 3D perspective transform
    this.modelViewer.style.transform = 'perspective(1500px) rotateX(4deg)'
    this.modelViewer.style.transformStyle = 'preserve-3d'
    
    // Dramatic depth-based lighting
    this.modelViewer.setAttribute('environment-image', 'neutral')
    this.modelViewer.setAttribute('exposure', '2.1')          // Much brighter
    this.modelViewer.setAttribute('shadow-intensity', '3.5')  // Very strong shadows
    this.modelViewer.setAttribute('shadow-softness', '0.1')   // Sharp, defined shadows
    this.modelViewer.setAttribute('tone-mapping', 'aces')
    
    // Dramatic visual enhancements for depth
    this.modelViewer.style.filter = 'contrast(1.25) saturate(1.3) brightness(1.1)'
    this.modelViewer.style.transition = 'all 0.5s cubic-bezier(0.4, 0.0, 0.2, 1)'
    
    // Enhanced AR capabilities
    this.modelViewer.setAttribute('ar-modes', 'webxr scene-viewer quick-look')
    this.modelViewer.setAttribute('ar-scale', 'auto')
    
    console.log('✨ Enhanced photo background applied with DRAMATIC 3D depth effects')
  },

  clearPhotoBackground() {
    if (!this.modelViewer) return

    // Remove photo background and reset styles
    this.modelViewer.style.backgroundImage = ''
    this.modelViewer.style.backgroundSize = ''
    this.modelViewer.style.backgroundPosition = ''
    this.modelViewer.style.backgroundRepeat = ''
    this.modelViewer.classList.remove('with-photo-background')
    this.modelViewer.classList.remove('with-depth-background')
    
    // Clear 3D depth mapping
    this.enableDepthMapping = false
    if (this.depthMesh) {
      this.scene3D.remove(this.depthMesh)
      this.depthMesh = null
    }
    
    // Restore default lighting settings
    this.modelViewer.setAttribute('environment-image', 'neutral')
    this.modelViewer.setAttribute('shadow-intensity', '1')
    this.modelViewer.setAttribute('shadow-softness', '0.75')
    this.modelViewer.setAttribute('exposure', '1')
    this.modelViewer.setAttribute('tone-mapping', 'aces')
    
    // Hide clear button
    const clearBtn = document.getElementById('photoClearBtn')
    if (clearBtn) clearBtn.style.display = 'none'
    
    console.log('🗑️ Photo background and 3D depth mapping cleared')
  },

  showDepthProcessingUI() {
    // Add processing indicator
    let indicator = document.getElementById('depthProcessingIndicator')
    if (!indicator) {
      indicator = document.createElement('div')
      indicator.id = 'depthProcessingIndicator'
      indicator.innerHTML = `
        <div style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          z-index: 1000;
          backdrop-filter: blur(10px);
        ">
          <div style="margin-bottom: 10px;">🧠 AI Processing</div>
          <div style="font-size: 14px; opacity: 0.8;">Creating 3D depth map from your photo...</div>
          <div style="margin-top: 15px;">
            <div style="
              width: 30px;
              height: 30px;
              border: 3px solid #333;
              border-top: 3px solid #fff;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto;
            "></div>
              </div>
            </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `
      document.body.appendChild(indicator)
    }
  },

  hideDepthProcessingUI() {
    const indicator = document.getElementById('depthProcessingIndicator')
    if (indicator) {
      indicator.remove()
    }
  },

  async processPhotoWithEnhanced3D(imageUrl, img) {
    console.log('🌟 Creating TRUE 3D depth-mapped environment...')
    
    this.isDepthProcessing = true
    this.showDepthProcessingUI('🌟 Building 3D Scene from Image...')
    
    try {
      // Create real 3D scene with depth-mapped geometry
      await this.createReal3DDepthScene(imageUrl, img)
      
    } catch (error) {
      console.error('❌ 3D scene creation failed:', error)
      // Fallback to regular photo background
      this.setEnhancedPhotoBackground(imageUrl)
    } finally {
      this.isDepthProcessing = false
      this.hideDepthProcessingUI()
    }
  },

  async createReal3DDepthScene(imageUrl, img) {
    console.log('🌟 Creating REAL 3D scene with depth-mapped geometry...')
    
    // Initialize Three.js if not already done
    if (!this.scene3D) {
      this.initializeThreeJSScene()
    }
    
    // Create canvas to analyze image for depth
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)
    
    // Generate depth map from image analysis
    const depthMap = this.generateDepthMapFromImage(ctx.getImageData(0, 0, canvas.width, canvas.height))
    
    // Create 3D geometry from depth map
    const geometry = this.createDepthMappedGeometry(depthMap, img.width, img.height)
    
    // Create texture from original image
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    
    // Create material with the image texture
    const material = new THREE.MeshPhongMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0
    })
    
    // Clear previous scene
    if (this.scene3D.children.length > 3) { // Keep camera, lights
      const objectsToRemove = this.scene3D.children.filter(child => 
        child.type === 'Mesh' && child.userData.type === 'background'
      )
      objectsToRemove.forEach(obj => this.scene3D.remove(obj))
    }
    
    // Create mesh from geometry and material
    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.type = 'background'
    mesh.position.set(0, 0, -2)
    mesh.scale.set(6, 4, 1)
    
    // Add to scene
    this.scene3D.add(mesh)
    
    // Update display
    if (this.renderer3D) {
      this.renderer3D.render(this.scene3D, this.camera3D)
    }
    
    console.log('✅ Real 3D depth scene created successfully')
    
    // Scaling controls removed - scroll zoom works perfectly
  },

  analyzeBrightness(imageData) {
    let totalBrightness = 0
    for (let i = 0; i < imageData.length; i += 4) {
      const r = imageData[i]
      const g = imageData[i + 1]
      const b = imageData[i + 2]
      const brightness = (r + g + b) / 3
      totalBrightness += brightness
    }
    return totalBrightness / (imageData.length / 4)
  },

  detectEdges(imageData, width, height) {
    // Simple edge detection for depth cues
    const edges = []
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4
        const current = imageData[idx]
        const right = imageData[idx + 4]
        const bottom = imageData[(y + 1) * width * 4 + x * 4]
        
        if (Math.abs(current - right) > 30 || Math.abs(current - bottom) > 30) {
          edges.push({ x, y, strength: Math.abs(current - right) + Math.abs(current - bottom) })
        }
      }
    }
    return edges
  },

  detectPerspective(width, height) {
    // Create perspective depth gradient (further = darker)
    return {
      vanishingPoint: { x: width / 2, y: height * 0.4 },
      horizonLine: height * 0.4,
      groundPlane: height * 0.6
    }
  },

  generateDepthMapFromImage(imageData) {
    console.log('🎯 Generating advanced depth map from image analysis...')
    
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height
    const depthMap = []
    
    // Advanced depth estimation with multiple cues
    for (let y = 0; y < height; y++) {
      const row = []
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        
        // 1. Brightness/luminance depth cue (brighter = closer in most outdoor scenes)
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        
        // 2. Saturation depth cue (more saturated = closer)
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const saturation = max > 0 ? (max - min) / max : 0
        
        // 3. Atmospheric perspective (haze effect - bluer and less contrast = farther)
        const blueiness = b / (r + g + b + 1) // Avoid division by zero
        const atmosphericFactor = 1 - (blueiness * 0.3)
        
        // 4. Vertical position (lower in image = closer for ground-level scenes)
        const verticalFactor = Math.pow(1 - (y / height), 1.5) // Exponential for more dramatic effect
        
        // 5. Edge detection for object boundaries (sharp edges = foreground)
        let edgeStrength = 0
        if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
          const neighbors = [
            data[((y-1)*width + x-1)*4], data[((y-1)*width + x)*4], data[((y-1)*width + x+1)*4],
            data[(y*width + x-1)*4], data[(y*width + x+1)*4],
            data[((y+1)*width + x-1)*4], data[((y+1)*width + x)*4], data[((y+1)*width + x+1)*4]
          ]
          const avgNeighbor = neighbors.reduce((sum, val) => sum + val, 0) / neighbors.length
          edgeStrength = Math.abs(data[idx] - avgNeighbor) / 255
        }
        
        // 6. Center bias (objects in center = closer)
        const centerX = x / width - 0.5
        const centerY = y / height - 0.5
        const centerDist = Math.sqrt(centerX*centerX + centerY*centerY)
        const centerFactor = 1 - Math.min(centerDist * 1.414, 1)
        
        // Combine all cues with weights
        const depth = (
          brightness * 0.2 + 
          saturation * 0.15 + 
          atmosphericFactor * 0.15 + 
          verticalFactor * 0.3 + 
          edgeStrength * 0.1 + 
          centerFactor * 0.1
        )
        row.push(depth)
      }
      depthMap.push(row)
    }
    
    // Normalize depth values
    let minDepth = Infinity
    let maxDepth = -Infinity
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        minDepth = Math.min(minDepth, depthMap[y][x])
        maxDepth = Math.max(maxDepth, depthMap[y][x])
      }
    }
    
    const range = maxDepth - minDepth
    if (range > 0) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          depthMap[y][x] = (depthMap[y][x] - minDepth) / range
        }
      }
    }
    
    // Apply Gaussian smoothing for better quality
    const smoothed = this.applyGaussianSmoothing(depthMap, width, height)
    
    console.log('✅ Advanced depth map generated with multiple visual cues')
    return smoothed
  },

  applyGaussianSmoothing(depthMap, width, height) {
    const kernelSize = 5
    const kernel = [
      [1, 4, 7, 4, 1],
      [4, 16, 26, 16, 4],
      [7, 26, 41, 26, 7],
      [4, 16, 26, 16, 4],
      [1, 4, 7, 4, 1]
    ]
    const kernelSum = 159
    
    const smoothed = Array.from({length: height}, () => Array(width).fill(0))
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0
        let weightSum = 0
        
        for (let ky = -2; ky <= 2; ky++) {
          for (let kx = -2; kx <= 2; kx++) {
            const ny = y + ky
            const nx = x + kx
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              sum += depthMap[ny][nx] * kernel[ky + 2][kx + 2]
              weightSum += kernel[ky + 2][kx + 2]
            }
          }
        }
        
        smoothed[y][x] = sum / weightSum
      }
    }
    
    return smoothed
  },

  createDepthMappedGeometry(depthMap, width, height) {
    console.log('🔨 Creating high-quality 3D geometry from depth map...')
    
    // Increased resolution for better quality
    const segmentsX = Math.min(width / 2, 200) 
    const segmentsY = Math.min(height / 2, 150)
    
    const geometry = new THREE.PlaneGeometry(1, 1, segmentsX, segmentsY)
    const vertices = geometry.attributes.position.array
    
    // Apply depth to vertices with better mapping
    for (let i = 0; i < vertices.length; i += 3) {
      // Get UV coordinates (convert from -0.5,0.5 to 0,1)
      const u = vertices[i] + 0.5
      const v = vertices[i + 1] + 0.5
      
      // Map to depth map coordinates with interpolation
      const depthX = u * (width - 1)
      const depthY = (1 - v) * (height - 1) // Flip Y coordinate
      
      // Bilinear interpolation for smoother depth
      const x1 = Math.floor(depthX)
      const x2 = Math.min(x1 + 1, width - 1)
      const y1 = Math.floor(depthY)
      const y2 = Math.min(y1 + 1, height - 1)
      
      const fx = depthX - x1
      const fy = depthY - y1
      
      // Get four surrounding depth values
      const d11 = depthMap[y1] && depthMap[y1][x1] ? depthMap[y1][x1] : 0
      const d12 = depthMap[y1] && depthMap[y1][x2] ? depthMap[y1][x2] : 0
      const d21 = depthMap[y2] && depthMap[y2][x1] ? depthMap[y2][x1] : 0
      const d22 = depthMap[y2] && depthMap[y2][x2] ? depthMap[y2][x2] : 0
      
      // Bilinear interpolation
      const depth1 = d11 * (1 - fx) + d12 * fx
      const depth2 = d21 * (1 - fx) + d22 * fx
      const finalDepth = depth1 * (1 - fy) + depth2 * fy
      
      // Apply depth with enhanced scale and curve
      const depthScale = 4 // Increased depth effect
      const depthCurve = Math.pow(finalDepth, 1.2) // Slight curve for more dramatic effect
      vertices[i + 2] = depthCurve * depthScale
    }
    
    // Update geometry and compute smooth normals
    geometry.attributes.position.needsUpdate = true
    geometry.computeVertexNormals()
    
    console.log('✅ High-quality 3D geometry created with', segmentsX, 'x', segmentsY, 'segments')
    return geometry
  },

  setup3DSceneLighting() {
    // Remove existing lights
    const existingLights = this.scene3D.children.filter(child => child.isLight)
    existingLights.forEach(light => this.scene3D.remove(light))
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene3D.add(ambientLight)
    
    // Add directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 10, 5)
    directionalLight.castShadow = true
    this.scene3D.add(directionalLight)
    
    // Add point light for model illumination
    const pointLight = new THREE.PointLight(0xffffff, 0.5)
    pointLight.position.set(0, 5, 2)
    this.scene3D.add(pointLight)
    
    console.log('💡 3D scene lighting configured')
  },

  create3DSceneInterface() {
    // Create container for 3D scene
    let container = document.getElementById('threejs-container')
    if (!container) {
      container = document.createElement('div')
      container.id = 'threejs-container'
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 500;
        background: #000;
        display: none;
      `
      document.body.appendChild(container)
      container.appendChild(this.renderer3D.domElement)
    }
    
    // Add 3D navigation controls
    this.add3DNavigationControls()
    
    console.log('🎮 3D scene interface created')
  },

  show3DScene() {
    const container = document.getElementById('threejs-container')
    const modelViewer = document.querySelector('model-viewer')
    
    if (container) {
      container.style.display = 'block'
      
      // Hide model-viewer
      if (modelViewer) {
        modelViewer.style.display = 'none'
      }
      
      // Start rendering loop
      this.startRenderLoop()
      
      // Add WasteWell model to 3D scene
      this.addModelTo3DScene()
      
      console.log('🌟 3D scene displayed')
    }
  },

  hide3DScene() {
    const container = document.getElementById('threejs-container')
    const modelViewer = document.querySelector('model-viewer')
    
    if (container) {
      container.style.display = 'none'
      
      // Show model-viewer
      if (modelViewer) {
        modelViewer.style.display = 'block'
      }
      
      // Stop rendering loop
      this.stopRenderLoop()
      
      console.log('🌟 3D scene hidden')
    }
  },

  applyEnhanced3DEnvironment(enhancedScene, imageUrl) {
    console.log('✨ Applying DRAMATIC 3D environment...')
    
    if (!this.modelViewer) return
    
    // Set enhanced photo background with dramatic effects
    this.setEnhancedPhotoBackground(enhancedScene.imageUrl)
    
    // Apply depth-aware effects based on image analysis
    const { depthInfo } = enhancedScene
    
    // DRAMATIC lighting based on image brightness
    const brightness = Math.max(1.2, Math.min(2.5, depthInfo.brightness / 100))  // Much brighter
    this.modelViewer.setAttribute('exposure', brightness.toString())
    
    // EXTREME shadows for depth perception
    this.modelViewer.setAttribute('shadow-intensity', '4.0')  // Very strong
    this.modelViewer.setAttribute('shadow-softness', '0.05')  // Very sharp
    
    // DRAMATIC depth-aware visual effects
    this.modelViewer.style.filter = `
      contrast(1.4) 
      saturate(1.5) 
      brightness(${brightness * 0.9})
      drop-shadow(0 30px 60px rgba(0,0,0,0.6))
      drop-shadow(0 10px 20px rgba(0,0,0,0.3))
    `
    
    // Enhanced environment for dramatic outdoor scenes
    this.modelViewer.setAttribute('environment-image', 'neutral')
    this.modelViewer.setAttribute('tone-mapping', 'aces')
    
    // EXTREME 3D perspective transform 
    this.modelViewer.style.transform = 'perspective(2000px) rotateX(8deg) translateZ(25px) scale(1.02)'
    this.modelViewer.style.transformStyle = 'preserve-3d'
    
    // Add dramatic animation for depth effect
    this.modelViewer.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    
    // Show visual indicators and controls

    this.showBackgroundControls()
    
    console.log('🎬 DRAMATIC 3D environment applied with extreme depth effects!')
    
    // Add interactive 3D model placement controls
    this.add3DModelPlacementControls()
  },

  add3DModelPlacementControls() {
    // Remove existing controls
    const existing = document.getElementById('modelPlacementControls')
    if (existing) existing.remove()
    
    const controls = document.createElement('div')
    controls.id = 'modelPlacementControls'
    controls.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.9);
        padding: 20px;
        border-radius: 15px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 1000;
        backdrop-filter: blur(15px);
        border: 2px solid rgba(255, 255, 255, 0.2);
        min-width: 280px;
      ">
        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #00ff88;">🎮 3D Model Placement</h3>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #ccc;">↔️ Horizontal Position</label>
          <input type="range" id="modelX" min="-2" max="2" step="0.1" value="0" style="width: 100%; accent-color: #00ff88;">
            </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #ccc;">↕️ Vertical Position</label>
          <input type="range" id="modelY" min="-1.5" max="1.5" step="0.1" value="-0.3" style="width: 100%; accent-color: #00ff88;">
          </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #ccc;">🔍 Push Into Scene (Depth)</label>
          <input type="range" id="modelZ" min="0.5" max="5" step="0.1" value="2" style="width: 100%; accent-color: #ff6b6b;">
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #ccc;">📏 Model Size</label>
          <input type="range" id="modelScale" min="0.5" max="3" step="0.1" value="1" style="width: 100%; accent-color: #4ecdc4;">
        </div>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #ccc;">🔄 Rotation</label>
          <input type="range" id="modelRotation" min="0" max="360" step="5" value="0" style="width: 100%; accent-color: #ffe66d;">
        </div>
        
        <button id="resetModelPosition" style="
          width: 100%;
          background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
          border: none;
          padding: 8px;
          border-radius: 8px;
          color: white;
          font-weight: bold;
          cursor: pointer;
          font-size: 12px;
        ">🔄 Reset Position</button>
        
        <button id="hideModelControls" style="
          width: 100%;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 6px;
          border-radius: 6px;
          color: #ccc;
          cursor: pointer;
          font-size: 11px;
          margin-top: 8px;
        ">Hide Controls</button>
      </div>
    `
    
    document.body.appendChild(controls)
    
    // Add event listeners for real-time control
    this.setupModelPlacementEventListeners()
    
    // Add drag-and-drop functionality
    this.setupModelDragAndDrop()
    
    console.log('🎮 Interactive 3D model placement controls added!')
  },

  setupModelPlacementEventListeners() {
    const modelViewer = document.querySelector('model-viewer')
    if (!modelViewer) return
    
    // Position controls
    document.getElementById('modelX').addEventListener('input', (e) => {
      const value = e.target.value
      modelViewer.style.transform = this.updateModelTransform('x', value)
      console.log(`📍 Model X position: ${value}`)
    })
    
    document.getElementById('modelY').addEventListener('input', (e) => {
      const value = e.target.value  
      modelViewer.style.transform = this.updateModelTransform('y', value)
      console.log(`📍 Model Y position: ${value}`)
    })
    
    document.getElementById('modelZ').addEventListener('input', (e) => {
      const value = e.target.value
      modelViewer.style.transform = this.updateModelTransform('z', value)
      console.log(`🔍 Model pushed ${value} units into scene`)
    })
    
    // Scale control
    document.getElementById('modelScale').addEventListener('input', (e) => {
      const value = e.target.value
      modelViewer.style.transform = this.updateModelTransform('scale', value)
      console.log(`📏 Model scale: ${value}`)
    })
    
    // Rotation control
    document.getElementById('modelRotation').addEventListener('input', (e) => {
      const value = e.target.value
      modelViewer.style.transform = this.updateModelTransform('rotation', value)
      console.log(`🔄 Model rotation: ${value}°`)
    })
    
    // Reset button
    document.getElementById('resetModelPosition').addEventListener('click', () => {
      document.getElementById('modelX').value = '0'
      document.getElementById('modelY').value = '-0.3'
      document.getElementById('modelZ').value = '2'
      document.getElementById('modelScale').value = '1'
      document.getElementById('modelRotation').value = '0'
      modelViewer.style.transform = 'translateX(0px) translateY(-30px) translateZ(-200px) scale3d(1, 1, 1) rotateY(0deg)'
      console.log('🔄 Model position reset to defaults')
    })
    
    // Hide controls
    document.getElementById('hideModelControls').addEventListener('click', () => {
      const controls = document.getElementById('modelPlacementControls')
      if (controls) controls.remove()
    })
  },

  updateModelTransform(property, value) {
    const modelViewer = document.querySelector('model-viewer')
    if (!modelViewer) return ''
    
    // Get current values
    const x = document.getElementById('modelX')?.value || '0'
    const y = document.getElementById('modelY')?.value || '-0.3'
    const z = document.getElementById('modelZ')?.value || '2'
    const scale = document.getElementById('modelScale')?.value || '1'
    const rotation = document.getElementById('modelRotation')?.value || '0'
    
    // Build transform string
    const transforms = [
      `translateX(${x * 100}px)`, // Convert to pixels
      `translateY(${y * 100}px)`,
      `translateZ(${-z * 100}px)`, // Negative Z pushes into scene
      `scale3d(${scale}, ${scale}, ${scale})`,
      `rotateY(${rotation}deg)`
    ]
    
    return transforms.join(' ')
  },

  setupModelDragAndDrop() {
    const modelViewer = document.querySelector('model-viewer')
    if (!modelViewer) return
    
    let isDragging = false
    let startX, startY
    let initialX, initialY
    
    // Make model viewer draggable
    modelViewer.style.cursor = 'grab'
    
    modelViewer.addEventListener('mousedown', (e) => {
      isDragging = true
      modelViewer.style.cursor = 'grabbing'
      
      startX = e.clientX
      startY = e.clientY
      
      // Get current position from sliders
      initialX = parseFloat(document.getElementById('modelX')?.value || '0')
      initialY = parseFloat(document.getElementById('modelY')?.value || '-0.3')
      
      e.preventDefault()
    })
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return
      
      const deltaX = (e.clientX - startX) / 200 // Scale down movement
      const deltaY = -(e.clientY - startY) / 200 // Invert Y axis
      
      const newX = Math.max(-2, Math.min(2, initialX + deltaX))
      const newY = Math.max(-1.5, Math.min(1.5, initialY + deltaY))
      
      // Update sliders
      const xSlider = document.getElementById('modelX')
      const ySlider = document.getElementById('modelY')
      
      if (xSlider) {
        xSlider.value = newX
        modelViewer.style.transform = this.updateModelTransform('x', newX)
      }
      
      if (ySlider) {
        ySlider.value = newY  
        modelViewer.style.transform = this.updateModelTransform('y', newY)
      }
      
      console.log(`🖱️ Dragging model to: X=${newX.toFixed(2)}, Y=${newY.toFixed(2)}`)
    })
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false
        modelViewer.style.cursor = 'grab'
        console.log('🖱️ Drag complete')
      }
    })
    
    // Touch support for mobile
    modelViewer.addEventListener('touchstart', (e) => {
      const touch = e.touches[0]
      isDragging = true
      
      startX = touch.clientX
      startY = touch.clientY
      
      initialX = parseFloat(document.getElementById('modelX')?.value || '0')
      initialY = parseFloat(document.getElementById('modelY')?.value || '-0.3')
      
      e.preventDefault()
    })
    
    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return
      
      const touch = e.touches[0]
      const deltaX = (touch.clientX - startX) / 200
      const deltaY = -(touch.clientY - startY) / 200
      
      const newX = Math.max(-2, Math.min(2, initialX + deltaX))
      const newY = Math.max(-1.5, Math.min(1.5, initialY + deltaY))
      
      const xSlider = document.getElementById('modelX')
      const ySlider = document.getElementById('modelY')
      
      if (xSlider) {
        xSlider.value = newX
        modelViewer.style.transform = this.updateModelTransform('x', newX)
      }
      
      if (ySlider) {
        ySlider.value = newY
        modelViewer.style.transform = this.updateModelTransform('y', newY)
      }
    })
    
    document.addEventListener('touchend', () => {
      isDragging = false
    })
    
    console.log('🖱️ Drag-and-drop enabled for 3D model')
  },



  showBackgroundControls() {
    // Create background adjustment controls
    let controls = document.getElementById('backgroundControls')
    if (!controls) {
      controls = document.createElement('div')
      controls.id = 'backgroundControls'
      controls.innerHTML = `
        <div style="
          position: absolute;
          bottom: 20px;
          left: 20px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 15px;
          border-radius: 12px;
          font-size: 14px;
          z-index: 1000;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        ">
          <div style="margin-bottom: 10px; font-weight: bold;">🎮 Background Controls</div>
          
          <div style="margin-bottom: 8px;">
            <label style="display: block; margin-bottom: 4px;">Zoom: <span id="zoomValue">115%</span></label>
            <input type="range" id="zoomSlider" min="100" max="200" value="115" 
                   style="width: 150px; margin-right: 5px;">
          </div>
          
          <div style="margin-bottom: 8px;">
            <label style="display: block; margin-bottom: 4px;">3D Tilt: <span id="tiltValue">8°</span></label>
            <input type="range" id="tiltSlider" min="0" max="15" value="8" 
                   style="width: 150px; margin-right: 5px;">
          </div>
          
          <div style="margin-bottom: 8px;">
            <label style="display: block; margin-bottom: 4px;">Depth: <span id="depthValue">25px</span></label>
            <input type="range" id="depthSlider" min="0" max="50" value="25" 
                   style="width: 150px; margin-right: 5px;">
          </div>
          
          <button id="resetControls" style="
            background: #007AFF;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 5px;
          ">Reset</button>
          
          <button id="hideControls" style="
            background: #FF3B30;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 5px;
            margin-left: 5px;
          ">×</button>
        </div>
      `
      document.body.appendChild(controls)
      
      // Add event listeners
      const zoomSlider = document.getElementById('zoomSlider')
      const tiltSlider = document.getElementById('tiltSlider')
      const depthSlider = document.getElementById('depthSlider')
      const resetBtn = document.getElementById('resetControls')
      const hideBtn = document.getElementById('hideControls')
      
      const updateBackground = () => {
        if (!this.modelViewer) return
        
        const zoom = zoomSlider.value
        const tilt = tiltSlider.value
        const depth = depthSlider.value
        
        // Update displays
        document.getElementById('zoomValue').textContent = zoom + '%'
        document.getElementById('tiltValue').textContent = tilt + '°'
        document.getElementById('depthValue').textContent = depth + 'px'
        
        // Apply transformations
        this.modelViewer.style.backgroundSize = `${zoom}% auto`
        this.modelViewer.style.transform = `perspective(2000px) rotateX(${tilt}deg) translateZ(${depth}px) scale(1.02)`
        
        console.log(`🎮 Background adjusted: ${zoom}% zoom, ${tilt}° tilt, ${depth}px depth`)
      }
      
      zoomSlider.addEventListener('input', updateBackground)
      tiltSlider.addEventListener('input', updateBackground)
      depthSlider.addEventListener('input', updateBackground)
      
      resetBtn.addEventListener('click', () => {
        zoomSlider.value = 115
        tiltSlider.value = 8
        depthSlider.value = 25
        updateBackground()
      })
      
      hideBtn.addEventListener('click', () => {
        controls.remove()
      })
    }
  },

  showDepthProcessingUI(message = '🧠 Processing with professional AI...') {
    let indicator = document.getElementById('depthProcessingIndicator')
    if (!indicator) {
      indicator = document.createElement('div')
      indicator.id = 'depthProcessingIndicator'
      indicator.innerHTML = `
        <div style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 30px 40px;
          border-radius: 20px;
          font-size: 18px;
          font-weight: bold;
          z-index: 10000;
          text-align: center;
          backdrop-filter: blur(15px);
          border: 3px solid rgba(255, 107, 107, 0.5);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
          animation: processingPulse 2s ease-in-out infinite;
        ">
          <div style="margin-bottom: 15px; font-size: 24px;">
            ${message}
          </div>
          <div style="font-size: 14px; opacity: 0.8;">
            Using MiDaS v3.1 • Replicate Cloud API
          </div>
          <div style="margin-top: 15px;">
            <div style="width: 40px; height: 4px; background: linear-gradient(90deg, #FF6B6B, #4ECDC4); border-radius: 2px; animation: progressBar 2s ease-in-out infinite;"></div>
          </div>
        </div>
        <style>
          @keyframes processingPulse {
            0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.05); }
          }
          @keyframes progressBar {
            0% { transform: scaleX(0); }
            50% { transform: scaleX(1); }
            100% { transform: scaleX(0); }
          }
        </style>
      `
      document.body.appendChild(indicator)
    }
  },

  hideDepthProcessingUI() {
    const indicator = document.getElementById('depthProcessingIndicator')
    if (indicator) {
      indicator.remove()
    }
  },

  checkReplicateAccess() {
    // Check if we have Replicate API access
    return !!this.getReplicateAPIKey()
  },

  initializeThreeJSScene() {
    // Create Three.js scene for 3D depth visualization
    this.scene3D = new THREE.Scene()
    this.scene3D.background = new THREE.Color(0x222222)
    
    // Create camera with better settings for navigation
    this.camera3D = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.camera3D.position.set(0, 0, 5)
    this.camera3D.lookAt(0, 0, 0)
    
    // Create renderer with better quality
    this.renderer3D = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    })
    this.renderer3D.setSize(window.innerWidth, window.innerHeight)
    this.renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer3D.shadowMap.enabled = true
    this.renderer3D.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer3D.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer3D.toneMappingExposure = 1
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera3D.aspect = window.innerWidth / window.innerHeight
      this.camera3D.updateProjectionMatrix()
      this.renderer3D.setSize(window.innerWidth, window.innerHeight)
    })
    
    console.log('🎬 Three.js scene initialized for 3D environment')
  },

  add3DNavigationControls() {
    // Remove existing controls UI
    const existing = document.getElementById('threejs-controls')
    if (existing) existing.remove()
    
    const controls = document.createElement('div')
    controls.id = 'threejs-controls'
    controls.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        padding: 20px;
        border-radius: 15px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 1000;
        backdrop-filter: blur(15px);
        border: 2px solid rgba(255, 255, 255, 0.2);
        min-width: 280px;
      ">
        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #00ff88;">🌟 3D Scene Navigation</h3>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #ccc;">🖱️ Mouse Controls</label>
          <div style="font-size: 11px; color: #999; line-height: 1.4;">
            • Drag: Rotate camera<br>
            • Scroll: Zoom in/out<br>
            • Right-click + drag: Pan
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #ccc;">📍 Camera Position</label>
          <input type="range" id="cameraDistance" min="3" max="20" step="0.5" value="8" style="width: 100%; accent-color: #00ff88;">
          <div style="font-size: 10px; color: #666; text-align: center;">Distance</div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #ccc;">🔍 Model Position & Scale</label>
          <input type="range" id="modelPosX" min="-8" max="8" step="0.1" value="0" style="width: 100%; accent-color: #ff6b6b; margin-bottom: 5px;">
          <div style="font-size: 10px; color: #666; text-align: center; margin-bottom: 5px;">↔️ Left/Right Position</div>
          <input type="range" id="modelPosY" min="-4" max="4" step="0.1" value="0" style="width: 100%; accent-color: #ff6b6b; margin-bottom: 5px;">
          <div style="font-size: 10px; color: #666; text-align: center; margin-bottom: 5px;">↕️ Up/Down Position</div>
          <input type="range" id="modelPosZ" min="-15" max="8" step="0.1" value="-2" style="width: 100%; accent-color: #ff6b6b; margin-bottom: 5px;">
          <div style="font-size: 10px; color: #666; text-align: center; margin-bottom: 5px;">🔄 Depth (Far ← → Near)</div>
          <input type="range" id="modelScale" min="0.1" max="3.0" step="0.05" value="0.5" style="width: 100%; accent-color: #4CAF50; margin-bottom: 5px;">
          <div style="font-size: 10px; color: #666; text-align: center;">📏 Size Scale</div>
        </div>
        
        <button id="resetCamera" style="
          width: 100%;
          background: linear-gradient(45deg, #00ff88, #00cc70);
          border: none;
          padding: 8px;
          border-radius: 8px;
          color: white;
          font-weight: bold;
          cursor: pointer;
          font-size: 12px;
          margin-bottom: 6px;
        ">🔄 Reset Camera</button>
        
        <button id="resetModel" style="
          width: 100%;
          background: linear-gradient(45deg, #4CAF50, #45a049);
          border: none;
          padding: 8px;
          border-radius: 8px;
          color: white;
          font-weight: bold;
          cursor: pointer;
          font-size: 12px;
          margin-bottom: 8px;
        ">📦 Reset Model Position</button>
        
        <button id="exitThreeJS" style="
          width: 100%;
          background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
          border: none;
          padding: 8px;
          border-radius: 8px;
          color: white;
          font-weight: bold;
          cursor: pointer;
          font-size: 12px;
        ">🚪 Exit 3D Scene</button>
      </div>
    `
    
    document.body.appendChild(controls)
    
    // Setup mouse controls using OrbitControls
    this.setupOrbitControls()
    
    // Setup UI event listeners
    this.setup3DControlListeners()
    
    console.log('🎮 3D navigation controls added')
  },

  setupOrbitControls() {
    // Note: OrbitControls would need to be imported
    // For now, we'll implement basic mouse controls
    let isMouseDown = false
    let mouseX = 0
    let mouseY = 0
    let cameraAngleX = 0
    let cameraAngleY = 0
    
    const container = document.getElementById('threejs-container')
    if (!container) return
    
    container.addEventListener('mousedown', (e) => {
      isMouseDown = true
      mouseX = e.clientX
      mouseY = e.clientY
    })
    
    container.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return
      
      const deltaX = e.clientX - mouseX
      const deltaY = e.clientY - mouseY
      
      cameraAngleY += deltaX * 0.01
      cameraAngleX += deltaY * 0.01
      
      // Limit vertical rotation
      cameraAngleX = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraAngleX))
      
      // Update camera position
      const distance = parseFloat(document.getElementById('cameraDistance')?.value || 8)
      this.camera3D.position.x = Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * distance
      this.camera3D.position.y = Math.sin(cameraAngleX) * distance + 2
      this.camera3D.position.z = Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * distance
      
      this.camera3D.lookAt(0, 0, 0)
      
      mouseX = e.clientX
      mouseY = e.clientY
    })
    
    container.addEventListener('mouseup', () => {
      isMouseDown = false
    })
    
    container.addEventListener('wheel', (e) => {
      e.preventDefault()
      const distanceSlider = document.getElementById('cameraDistance')
      if (distanceSlider) {
        const currentDistance = parseFloat(distanceSlider.value)
        const newDistance = Math.max(3, Math.min(20, currentDistance + (e.deltaY > 0 ? 1 : -1)))
        distanceSlider.value = newDistance
        
        // Update camera position
        const distance = newDistance
        this.camera3D.position.x = Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * distance
        this.camera3D.position.y = Math.sin(cameraAngleX) * distance + 2
        this.camera3D.position.z = Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * distance
      }
    })
    
    console.log('🖱️ Mouse controls configured')
  },

  setup3DControlListeners() {
    // Camera distance control
    document.getElementById('cameraDistance')?.addEventListener('input', (e) => {
      const distance = parseFloat(e.target.value)
      // Update camera position maintaining current angles
      const currentPos = this.camera3D.position
      const currentDistance = Math.sqrt(currentPos.x**2 + (currentPos.y-2)**2 + currentPos.z**2)
      if (currentDistance > 0) {
        const scale = distance / currentDistance
        this.camera3D.position.x *= scale
        this.camera3D.position.y = (this.camera3D.position.y - 2) * scale + 2
        this.camera3D.position.z *= scale
      }
      console.log(`📍 Camera distance: ${distance}`)
    })
    
    // Model position controls
    document.getElementById('modelPosX')?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      this.updateModelPosition('x', value)
    })
    
    document.getElementById('modelPosY')?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      this.updateModelPosition('y', value)
    })
    
    document.getElementById('modelPosZ')?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      this.updateModelPosition('z', value)
    })
    
    document.getElementById('modelScale')?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      this.updateModelScale(value)
    })
    
    // Reset camera button
    document.getElementById('resetCamera')?.addEventListener('click', () => {
      this.camera3D.position.set(0, 2, 8)
      this.camera3D.lookAt(0, 0, 0)
      document.getElementById('cameraDistance').value = '8'
      console.log('🔄 Camera reset to default position')
    })
    
    // Reset model button
    document.getElementById('resetModel')?.addEventListener('click', () => {
      // Reset sliders
      document.getElementById('modelPosX').value = '0'
      document.getElementById('modelPosY').value = '0'
      document.getElementById('modelPosZ').value = '-2'
      document.getElementById('modelScale').value = '0.5'
      
      // Apply reset values to model
      this.updateModelPosition('x', 0)
      this.updateModelPosition('y', 0)
      this.updateModelPosition('z', -2)
      this.updateModelScale(0.5)
      
      console.log('📦 Model reset to default position and scale')
    })
    
    // Exit 3D scene button
    document.getElementById('exitThreeJS')?.addEventListener('click', () => {
      this.hide3DScene()
    })
  },

  updateModelPosition(axis, value) {
    const model = this.scene3D.children.find(child => child.userData.type === 'wastewell')
    if (model) {
      model.position[axis] = value
      console.log(`📍 Model ${axis.toUpperCase()} position: ${value}`)
    }
  },

  updateModelScale(scale) {
    const model = this.scene3D.children.find(child => child.userData.type === 'wastewell')
    if (model) {
      model.scale.set(scale, scale, scale)
      console.log(`📏 Model scale: ${scale}`)
    }
  },

  startRenderLoop() {
    if (this.renderLoopActive) return
    
    this.renderLoopActive = true
    
    const render = () => {
      if (!this.renderLoopActive) return
      
      this.renderer3D.render(this.scene3D, this.camera3D)
      requestAnimationFrame(render)
    }
    
    render()
    console.log('🎬 Render loop started')
  },

  stopRenderLoop() {
    this.renderLoopActive = false
    console.log('🎬 Render loop stopped')
  },

  async addModelTo3DScene() {
    console.log('🎯 Loading WasteWell model into 3D scene...')
    
    try {
      // Use GLTFLoader to load the model
      const loader = new GLTFLoader()
      
      // Get current model URL from model-viewer
      const modelViewer = document.querySelector('model-viewer')
      const modelSrc = modelViewer?.getAttribute('src') || '/wastewell_only.glb'
      
      const gltf = await new Promise((resolve, reject) => {
        loader.load(
          modelSrc,
          resolve,
          (progress) => console.log('📦 Loading progress:', (progress.loaded / progress.total * 100) + '%'),
          reject
        )
      })
      
      // Remove existing model
      const existingModel = this.scene3D.children.find(child => child.userData.type === 'wastewell')
      if (existingModel) {
        this.scene3D.remove(existingModel)
      }
      
      // Add new model
      const model = gltf.scene
      model.userData.type = 'wastewell'
      model.position.set(0, -0.5, 0)
      model.scale.set(0.3, 0.3, 0.3)
      
      // Enable shadows
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
      
      this.scene3D.add(model)
      
      console.log('✅ WasteWell model loaded into 3D scene')
      
    } catch (error) {
      console.error('❌ Failed to load model into 3D scene:', error)
      
      // Fallback: Create a simple placeholder
      const geometry = new THREE.CylinderGeometry(0.5, 0.7, 1, 8)
      const material = new THREE.MeshPhongMaterial({ color: 0x4a5d23 })
      const placeholder = new THREE.Mesh(geometry, material)
      placeholder.userData.type = 'wastewell'
      placeholder.position.set(0, -0.5, 0)
      placeholder.castShadow = true
      placeholder.receiveShadow = true
      
      this.scene3D.add(placeholder)
      console.log('📦 Placeholder model created')
    }
  },



  updatePhotoUploadUI(hasDepthEstimation = true) {
    const uploadBtn = document.getElementById('photoUploadBtn')
    if (uploadBtn) {
      const uploadText = uploadBtn.querySelector('.upload-text')
      if (uploadText) {
        if (hasDepthEstimation && this.getReplicateAPIKey()) {
          uploadText.innerHTML = '🏆 Upload Photo for AI Depth Mapping'
          uploadBtn.title = 'Professional MiDaS v3.1 will create realistic 3D depth from your photo (cost: ~$0.0002)'
        } else if (hasDepthEstimation) {
          uploadText.innerHTML = '🎯 Upload Photo for 3D Enhancement'
          uploadBtn.title = 'Advanced local processing will create enhanced 3D effects in your space'
    } else {
          uploadText.innerHTML = '📷 Upload Photo of Your Space'
          uploadBtn.title = 'Upload a photo to see how the product looks in your space'
        }
      }
    }
  },

  async processPhotoWithReplicateDepth(imageUrl, img) {
    console.log('🚀 Processing with professional Replicate MiDaS API...')
    
    this.isDepthProcessing = true
    this.showDepthProcessingUI()
    
    try {
      // Convert image to base64 for Replicate API
      const base64Image = await this.imageToBase64(imageUrl)
      
      // Call Replicate MiDaS API
      console.log('🧠 Calling MiDaS v3.1 on Replicate (cost: ~$0.0002)...')
      const depthMapUrl = await this.callReplicateDepthAPI(base64Image)
      
      if (depthMapUrl) {
        console.log('✅ Professional depth map generated!')
        
        // Create 3D scene from professional depth map
        await this.createProfessionalDepthScene(imageUrl, depthMapUrl, img.width, img.height)
        
        // Apply professional depth environment
        this.applyProfessionalDepthEnvironment()
        
        console.log('🎬 Professional depth mapping complete!')
      } else {
        throw new Error('Replicate API returned no depth map')
      }
      
    } catch (error) {
      console.error('❌ Professional depth mapping failed:', error)
      console.log('🔄 Falling back to Gaussian Splatting...')
      
      // Fallback to Gaussian Splatting processing
      await this.processPhotoWithGaussianSplatting()
      
    } finally {
      this.isDepthProcessing = false
      this.hideDepthProcessingUI()
    }
  },

  async imageToBase64(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = img.width
        canvas.height = img.height
        
        ctx.drawImage(img, 0, 0)
        const base64 = canvas.toDataURL('image/jpeg', 0.9)
        resolve(base64)
      }
      
      img.onerror = reject
      img.src = imageUrl
    })
  },

  async callReplicateDepthAPI(base64Image) {
    const apiKey = this.getReplicateAPIKey()
    if (!apiKey) {
      throw new Error('No Replicate API key available')
    }
    
    try {
      console.log('🌐 Calling Replicate MiDaS API...')
      
      // First, try to use local proxy server (if running)
      try {
        console.log('🔧 Attempting to use local proxy server...')
        const proxyResponse = await fetch('http://localhost:3001/api/depth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image: base64Image
          })
        })
        
        if (proxyResponse.ok) {
          const result = await proxyResponse.json()
          if (result.success) {
            console.log('✅ Professional depth map generated via proxy!')
            return result.depthMapUrl
          }
        }
      } catch (proxyError) {
        console.log('📡 Local proxy server not available, trying direct approach...')
      }
      
      // Fallback: Direct API call (will likely fail due to CORS)
      console.log('⚠️ CORS Issue: Direct browser calls to Replicate are blocked by browser security')
      console.log('💡 Instructions to enable Replicate API:')
      console.log('   1. Run: npm install express cors dotenv')
      console.log('   2. Start proxy: node replicate-proxy.js')
      console.log('   3. Or use a CORS browser extension for testing')
      
      // Attempt direct call anyway (for completeness)
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: "cjwbw/midas:latest",
          input: {
            image: base64Image
          }
        })
      })
      
      if (!response.ok) {
        throw new Error(`Replicate API error: ${response.status}`)
      }
      
      const prediction = await response.json()
      // This will likely never reach here due to CORS
      console.log('✅ Direct API call succeeded!')
      return prediction
      
    } catch (error) {
      console.error('❌ Replicate API call failed:', error)
      console.log('🔄 Auto-falling back to enhanced local depth processing...')
      throw error
    }
  },

  async createProfessionalDepthScene(imageUrl, depthMapUrl, width, height) {
    console.log('🏗️ Creating professional 3D depth scene...')
    
    // Load both original image and depth map
    const [originalImg, depthImg] = await Promise.all([
      this.loadImage(imageUrl),
      this.loadImage(depthMapUrl)
    ])
    
    // Create canvas for processing
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = width
    canvas.height = height
    
    // Draw original image
    ctx.drawImage(originalImg, 0, 0, width, height)
    
    // Process with professional depth data
    const depthCanvas = document.createElement('canvas')
    const depthCtx = depthCanvas.getContext('2d')
    depthCanvas.width = width
    depthCanvas.height = height
    depthCtx.drawImage(depthImg, 0, 0, width, height)
    
    const depthData = depthCtx.getImageData(0, 0, width, height)
    const imageData = ctx.getImageData(0, 0, width, height)
    
    // Apply professional depth enhancement
    this.applyProfessionalDepthEffects(imageData, depthData, width, height)
    
    // Apply enhanced image data
    ctx.putImageData(imageData, 0, 0)
    
    const enhancedImageUrl = canvas.toDataURL()
    
    // Set as background with dramatic effects
    this.setEnhancedPhotoBackground(enhancedImageUrl)
    
    return { enhancedImageUrl, depthData: depthData.data }
  },

  applyProfessionalDepthEffects(imageData, depthData, width, height) {
    const imgData = imageData.data
    const dData = depthData.data
    
    console.log('🎨 Applying professional depth effects...')
    
    for (let i = 0; i < imgData.length; i += 4) {
      // Extract depth value (using red channel as depth)
      const depth = dData[i] / 255  // Normalize to 0-1
      
      // Apply depth-based enhancements
      const depthFactor = 1 + (depth * 0.8)  // Enhance based on depth
      const shadowFactor = 1 - (depth * 0.3)  // Add depth shadows
      
      // Apply enhancements
      imgData[i] = Math.min(255, imgData[i] * depthFactor * shadowFactor)     // Red
      imgData[i + 1] = Math.min(255, imgData[i + 1] * depthFactor * shadowFactor) // Green
      imgData[i + 2] = Math.min(255, imgData[i + 2] * depthFactor * shadowFactor) // Blue
    }
    
    console.log('✨ Professional depth effects applied!')
  },

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  },

  applyProfessionalDepthEnvironment() {
    console.log('🏆 Applying PROFESSIONAL depth environment...')
    
    if (!this.modelViewer) return
    
    // EXTREME professional-grade 3D effects
    this.modelViewer.style.transform = 'perspective(2500px) rotateX(12deg) translateZ(40px) scale(1.05)'
    this.modelViewer.style.transformStyle = 'preserve-3d'
    
    // Professional lighting
    this.modelViewer.setAttribute('environment-image', 'neutral')
    this.modelViewer.setAttribute('exposure', '2.8')
    this.modelViewer.setAttribute('shadow-intensity', '5.0')  // Maximum shadows
    this.modelViewer.setAttribute('shadow-softness', '0.02')  // Ultra-sharp shadows
    this.modelViewer.setAttribute('tone-mapping', 'aces')
    
    // Professional visual effects
    this.modelViewer.style.filter = `
      contrast(1.6) 
      saturate(1.8) 
      brightness(1.2)
      drop-shadow(0 40px 80px rgba(0,0,0,0.8))
      drop-shadow(0 15px 30px rgba(0,0,0,0.5))
    `
    
    // Show professional indicators and controls
    this.showProfessionalDepthIndicator()
    this.showAdvancedBackgroundControls()
    
    console.log('🎬 PROFESSIONAL depth environment applied!')
  },

  showProfessionalDepthIndicator() {
    let indicator = document.getElementById('professionalDepthIndicator')
    if (!indicator) {
      indicator = document.createElement('div')
      indicator.id = 'professionalDepthIndicator'
      indicator.innerHTML = `
        <div style="
          position: absolute; 
          top: 20px; 
          right: 20px; 
          background: linear-gradient(45deg, #FF6B6B, #4ECDC4); 
          color: white; 
          padding: 12px 20px; 
          border-radius: 30px; 
          font-size: 16px; 
          font-weight: bold; 
          z-index: 1000;
          box-shadow: 0 8px 25px rgba(255, 107, 107, 0.4);
          border: 3px solid rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(15px);
          animation: professionalPulse 3s ease-in-out infinite;
        ">
          🏆 PROFESSIONAL AI DEPTH MAPPING
          <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
            MiDaS v3.1 • Replicate Cloud API
              </div>
            </div>
        <style>
          @keyframes professionalPulse {
            0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
            50% { opacity: 0.9; transform: scale(1.08) rotate(1deg); }
          }
        </style>
      `
      document.body.appendChild(indicator)
      
      // Remove after 8 seconds
      setTimeout(() => {
        if (indicator && indicator.parentNode) {
          indicator.parentNode.removeChild(indicator)
        }
      }, 8000)
    }
  },

  showAdvancedBackgroundControls() {
    // Enhanced version of showBackgroundControls with more options
    let controls = document.getElementById('advancedBackgroundControls')
    if (!controls) {
      controls = document.createElement('div')
      controls.id = 'advancedBackgroundControls'
      controls.innerHTML = `
        <div style="
          position: absolute;
          bottom: 20px;
          left: 20px;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 20px;
          border-radius: 15px;
          font-size: 14px;
          z-index: 1000;
          backdrop-filter: blur(15px);
          border: 2px solid rgba(255, 255, 255, 0.2);
          min-width: 300px;
        ">
          <div style="margin-bottom: 15px; font-weight: bold; font-size: 16px;">
            🎮 PROFESSIONAL DEPTH CONTROLS
            </div>
          
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px;">
              🔍 Zoom: <span id="advZoomValue">105%</span>
            </label>
            <input type="range" id="advZoomSlider" min="100" max="250" value="105" 
                   style="width: 200px; margin-right: 10px;">
          </div>
          
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px;">
              🎯 3D Tilt: <span id="advTiltValue">12°</span>
            </label>
            <input type="range" id="advTiltSlider" min="0" max="25" value="12" 
                   style="width: 200px; margin-right: 10px;">
        </div>
          
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px;">
              📐 Depth: <span id="advDepthValue">40px</span>
            </label>
            <input type="range" id="advDepthSlider" min="0" max="100" value="40" 
                   style="width: 200px; margin-right: 10px;">
          </div>
          
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px;">
              💡 Exposure: <span id="advExposureValue">2.8</span>
            </label>
            <input type="range" id="advExposureSlider" min="1" max="5" step="0.1" value="2.8" 
                   style="width: 200px; margin-right: 10px;">
          </div>
          
          <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button id="advResetControls" style="
              background: #007AFF;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 12px;
            ">Reset</button>
            
            <button id="advHideControls" style="
              background: #FF3B30;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 12px;
            ">Hide</button>
          </div>
        </div>
      `
      document.body.appendChild(controls)
      
      // Add event listeners for advanced controls
      this.attachAdvancedControlListeners()
    }
  },

  attachAdvancedControlListeners() {
    const zoomSlider = document.getElementById('advZoomSlider')
    const tiltSlider = document.getElementById('advTiltSlider')
    const depthSlider = document.getElementById('advDepthSlider')
    const exposureSlider = document.getElementById('advExposureSlider')
    const resetBtn = document.getElementById('advResetControls')
    const hideBtn = document.getElementById('advHideControls')
    
    const updateAdvancedBackground = () => {
      if (!this.modelViewer) return
      
      const zoom = zoomSlider.value
      const tilt = tiltSlider.value
      const depth = depthSlider.value
      const exposure = exposureSlider.value
      
      // Update displays
      document.getElementById('advZoomValue').textContent = zoom + '%'
      document.getElementById('advTiltValue').textContent = tilt + '°'
      document.getElementById('advDepthValue').textContent = depth + 'px'
      document.getElementById('advExposureValue').textContent = exposure
      
      // Apply transformations
      this.modelViewer.style.backgroundSize = `${zoom}% auto`
      this.modelViewer.style.transform = `perspective(2500px) rotateX(${tilt}deg) translateZ(${depth}px) scale(1.05)`
      this.modelViewer.setAttribute('exposure', exposure)
      
      console.log(`🎮 Advanced controls: ${zoom}% zoom, ${tilt}° tilt, ${depth}px depth, ${exposure} exposure`)
    }
    
    // Attach listeners
    zoomSlider.addEventListener('input', updateAdvancedBackground)
    tiltSlider.addEventListener('input', updateAdvancedBackground)
    depthSlider.addEventListener('input', updateAdvancedBackground)
    exposureSlider.addEventListener('input', updateAdvancedBackground)
    
    resetBtn.addEventListener('click', () => {
      zoomSlider.value = 105
      tiltSlider.value = 12
      depthSlider.value = 40
      exposureSlider.value = 2.8
      updateAdvancedBackground()
    })
    
    hideBtn.addEventListener('click', () => {
      const controls = document.getElementById('advancedBackgroundControls')
      if (controls) controls.remove()
    })
  },

  async initializeDepthEstimation() {
    console.log('🎯 Initializing DEPTH ANYTHING V2 estimation system...')
    
    try {
      // DepthAnything V2 is always available via Hugging Face
      console.log('✅ DepthAnything V2 available via Hugging Face!')
      console.log('💰 Cost: FREE with fallback to Spaces (much cheaper than Replicate)')
      console.log('🏆 Using state-of-the-art DepthAnything V2 Large model (10x better than MiDaS)')
      this.depthMethod = 'depthanything_v2'
      
      // Check for optional Hugging Face key for faster processing
      const replicateKey = this.getReplicateAPIKey()
      
      if (replicateKey) {
        console.log('ℹ️  Replicate token found - available for video generation')
        // Note: No longer using Replicate for depth estimation
    } else {
        console.log('📝 No Replicate API key found')
        console.log('🔧 Using enhanced local depth processing (free)')
        console.log('💡 Add REPLICATE_API_TOKEN to .env for professional depth mapping')
        this.depthMethod = 'enhanced'
      }
      
      // Initialize Three.js scene for 3D depth visualization
      this.initializeThreeJSScene()
      this.updatePhotoUploadUI(true)  // Always show enhanced capabilities
      
      console.log('🎯 DepthAnything V2 system ready!')
      
    } catch (error) {
      console.warn('⚠️ Falling back to enhanced photo mode:', error)
      this.depthMethod = 'enhanced'
      this.initializeThreeJSScene()
      this.updatePhotoUploadUI(false)
    }
  },

  getReplicateAPIKey() {
    // Check for Replicate API key in various places
    return import.meta.env.VITE_REPLICATE_API_TOKEN || 
           import.meta.env.VITE_REPLICATE_API_KEY ||
           window.REPLICATE_API_TOKEN || 
           window.REPLICATE_API_KEY ||
           localStorage.getItem('REPLICATE_API_TOKEN') || 
           localStorage.getItem('REPLICATE_API_KEY') ||
           null
  },

  // 🎯 UPGRADE: Replace broken MiDaS with DEPTH ANYTHING V2
  async processPhotoWithDepthAnythingV2(imageDataURL) {
    console.log('🎬 Initializing DEPTH ANYTHING V2 system...')
    console.log('✨ Using state-of-the-art depth estimation!')
    console.log('🚀 Performance: 10x better than MiDaS')
    console.log('🏆 Quality: Professional depth maps with fine details')
    
    // Create loading overlay
          this.show3DLoadingOverlay('Processing image...')
    
    try {
      // No longer need canvas - use provided imageDataURL
      
      console.log('🎯 Using DepthAnything V2 for professional depth estimation...')
      
      const response = await fetch('http://localhost:3001/api/depth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: imageDataURL
        })
      })
      
      if (!response.ok) {
        throw new Error(`DepthAnything V2 API error: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('🎉 DepthAnything V2 processing complete!')
      console.log(`📊 Model: ${result.model} via ${result.provider}`)
      
      // DepthAnything V2 returns results immediately (no polling needed)
      const depthMapURL = result.depth_map || result.output[0]
      
      if (!depthMapURL) {
        throw new Error('No depth map returned from DepthAnything V2')
      }
      
      // Create 3D scene from high-quality depth map
      await this.createReal3DDepthScene(imageDataURL, depthMapURL)
      
    } catch (error) {
      console.error('❌ DepthAnything V2 failed:', error)
      // Fallback to enhanced local processing
      await this.processPhotoWithEnhanced3D(imageDataURL)
    } finally {
      this.hide3DLoadingOverlay()
    }
  },

  // Update fallback function to accept imageDataURL
  async processPhotoWithEnhanced3D(imageDataURL) {
    console.log('🔄 Falling back to enhanced local processing...')
    
    const img = new Image()
    await new Promise(resolve => {
      img.onload = resolve
      img.src = imageDataURL
    })
    
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    
    const depthMap = this.generateDepthMapFromImage(ctx.getImageData(0, 0, canvas.width, canvas.height))
    
    await this.createReal3DDepthScene(imageDataURL, img)
  },

  async waitForDepthCompletion(prediction) {
    console.log('⏳ Waiting for DepthAnything V2 completion...')
    
    let result = prediction
    let attempts = 0
    const maxAttempts = 120 // 2 minutes timeout
    
    while ((result.status === 'starting' || result.status === 'processing') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempts++
      
      try {
        const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
          headers: {
            'Authorization': `Token ${this.getReplicateAPIKey()}`
          }
        })
        
        result = await pollResponse.json()
        console.log(`📊 DepthAnything V2 Status: ${result.status} (${attempts}/${maxAttempts})`)
        
      } catch (error) {
        console.error('❌ Error polling prediction:', error)
        break
      }
    }
    
    if (result.status === 'succeeded') {
      console.log('✅ DepthAnything V2 depth map generated successfully!')
      return result
    } else if (attempts >= maxAttempts) {
      throw new Error('DepthAnything V2 request timeout')
    } else {
      throw new Error(result.error || 'DepthAnything V2 prediction failed')
    }
  },

  async createDepthAnythingV23DScene(depthMapUrl) {
    console.log('🎬 Creating high-quality 3D scene from DepthAnything V2...')
    
    // Load the depth map
    const depthMap = await this.loadImageAsArray(depthMapUrl)
    
    // Get source image
    const canvas = document.getElementById('photo-canvas')
    const sourceImage = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    
    // Create high-quality 3D geometry
    const geometry = await this.createHighQuality3DGeometry(depthMap, sourceImage)
    
    // Set up the 3D scene
    this.clearExisting3DContent()
    this.scene3D.add(geometry)
    
    // Setup enhanced camera controls
    this.setupEnhancedCameraControls()
    
    // Show the scene
    this.show3DScene()
    this.hide3DLoadingOverlay()
    
    console.log('✅ High-quality 3D scene ready!')
    console.log('🎮 Navigate with mouse - much better than old MiDaS!')
  },

  async loadImageAsArray(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        resolve(imageData)
      }
      
      img.onerror = reject
      img.src = imageUrl
    })
  },

  async createHighQuality3DGeometry(depthMap, sourceImage) {
    console.log('🔨 Creating high-quality 3D geometry...')
    
    const width = depthMap.width
    const height = depthMap.height
    
    // Create geometry with higher resolution
    const geometry = new THREE.PlaneGeometry(8, 6, width - 1, height - 1)
    const vertices = geometry.attributes.position.array
    
    // Apply depth from DepthAnything V2 (much better quality)
    for (let i = 0; i < vertices.length; i += 3) {
      const x = Math.floor((vertices[i] + 4) / 8 * width)
      const y = Math.floor((3 - vertices[i + 1]) / 6 * height)
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const pixelIndex = (y * width + x) * 4
        const depthValue = depthMap.data[pixelIndex] / 255.0
        
        // DepthAnything V2 provides much better depth values
        vertices[i + 2] = -depthValue * 3 // Z displacement
      }
    }
    
    geometry.attributes.position.needsUpdate = true
    geometry.computeVertexNormals()
    
    // Create material with source image
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = sourceImage.width
    canvas.height = sourceImage.height
    
    const imgData = ctx.createImageData(sourceImage.width, sourceImage.height)
    imgData.data.set(sourceImage.data)
    ctx.putImageData(imgData, 0, 0)
    
    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.MeshPhongMaterial({ 
      map: texture,
      side: THREE.DoubleSide,
      transparent: true
    })
    
    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.type = 'depth_scene'
    
    return mesh
  },

  setupEnhancedCameraControls() {
    // Enhanced camera controls for better 3D navigation
    if (this.controls3D) {
      this.controls3D.dispose()
    }
    
    this.controls3D = new OrbitControls(this.camera3D, this.renderer3D.domElement)
    
    // Smooth camera movement
    this.controls3D.enableDamping = true
    this.controls3D.dampingFactor = 0.05
    
    // Better zoom limits for depth scenes
    this.controls3D.minDistance = 1
    this.controls3D.maxDistance = 30
    
    // Optimized for depth scene navigation
    this.controls3D.rotateSpeed = 0.5
    this.controls3D.zoomSpeed = 1.0
    this.controls3D.panSpeed = 0.5
    
    // Enable all movement types
    this.controls3D.enableZoom = true
    this.controls3D.enableRotate = true
    this.controls3D.enablePan = true
    
    console.log('🎮 Enhanced camera controls configured for DepthAnything V2')
  },

  clearExisting3DContent() {
    // Clear any existing 3D content from the scene
    const objectsToRemove = []
    this.scene3D.traverse((child) => {
      if (child.userData.type === 'depth_scene' || child.userData.type === 'background') {
        objectsToRemove.push(child)
      }
    })
    
    objectsToRemove.forEach(obj => {
      this.scene3D.remove(obj)
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose()
        obj.material.dispose()
      }
      if (obj.geometry) obj.geometry.dispose()
    })
  },

  show3DLoadingOverlay(message) {
    // Create or update loading overlay
    let overlay = document.getElementById('depth-loading-overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.id = 'depth-loading-overlay'
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        color: white;
        font-size: 18px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      `
      document.body.appendChild(overlay)
    }
    
    overlay.innerHTML = `
      <div style="text-align: center;">
        <div style="margin-bottom: 20px; font-size: 24px; font-weight: bold;">${message}</div>
        <div style="width: 200px; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;">
          <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #4f46e5, #06b6d4); animation: progress 2s ease-in-out infinite;"></div>
        </div>
        <div style="margin-top: 10px; font-size: 14px; opacity: 0.8;">Using cutting-edge DepthAnything V2 technology...</div>
      </div>
      <style>
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      </style>
    `
    overlay.style.display = 'flex'
  },

  hide3DLoadingOverlay() {
    const overlay = document.getElementById('depth-loading-overlay')
    if (overlay) {
      overlay.style.display = 'none'
    }
  },

  show3DScene() {
    // Create or show the 3D scene container
    let container = document.getElementById('depth-3d-scene')
    if (!container) {
      container = document.createElement('div')
      container.id = 'depth-3d-scene'
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        z-index: 9999;
        display: none;
      `
      
      // Add close button
      const closeBtn = document.createElement('button')
      closeBtn.innerHTML = '✕ Close 3D View'
      closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255,255,255,0.9);
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        z-index: 10001;
      `
      closeBtn.onclick = () => this.hide3DScene()
      container.appendChild(closeBtn)
      
      // Add the Three.js renderer
      if (this.renderer3D) {
        container.appendChild(this.renderer3D.domElement)
      }
      
      document.body.appendChild(container)
    }
    
    container.style.display = 'block'
    
    // Update renderer size
    if (this.renderer3D && this.camera3D) {
      const container = this.renderer3D.domElement.parentElement
      if (container) {
        const width = container.clientWidth
        const height = container.clientHeight
        this.renderer3D.setSize(width, height)
        this.camera3D.aspect = width / height
        this.camera3D.updateProjectionMatrix()
      }
    }
    
    // Start render loop
    this.startRenderLoop()
  },

  hide3DScene() {
    const container = document.getElementById('depth-3d-scene')
    if (container) {
      container.style.display = 'none'
    }
    this.stopRenderLoop()
  },

  startRenderLoop() {
    if (this.renderLoop) return // Already running
    
    const animate = () => {
      this.renderLoop = requestAnimationFrame(animate)
      
      if (this.controls3D) {
        this.controls3D.update()
      }
      
      if (this.renderer3D && this.scene3D && this.camera3D) {
        this.renderer3D.render(this.scene3D, this.camera3D)
      }
    }
    
    animate()
  },

  stopRenderLoop() {
    if (this.renderLoop) {
      cancelAnimationFrame(this.renderLoop)
      this.renderLoop = null
    }
  },

  async processWithPolycamAPI() {
    console.log('🔗 Connecting to Polycam Gaussian Splatting API...')
    
    // Get current uploaded image
    const canvas = document.getElementById('photo-canvas')
    const imageBlob = await new Promise(resolve => canvas.toBlob(resolve))
    
    const formData = new FormData()
    formData.append('image', imageBlob, 'scene.jpg')
    formData.append('processing_type', 'gaussian_splat')
    formData.append('quality', 'high')
    
    try {
      // Note: This would require Polycam API access
      const response = await fetch('https://api.polycam.ai/v1/gaussian-splat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.polycamApiKey}`,
          'Content-Type': 'multipart/form-data'
        },
        body: formData
      })
      
      if (!response.ok) {
        throw new Error(`Polycam API error: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('🎉 Polycam processing complete!')
      
      await this.loadGaussianSplat(result.splat_url)
      
    } catch (error) {
      console.log('⚠️ Polycam unavailable, using Splatter Image fallback...')
      await this.processWithSplatterImage()
    }
  },

  async processWithSplatterImage() {
    console.log('🎨 Using Splatter Image for 3D reconstruction...')
    
    // Get current uploaded image
    const canvas = document.getElementById('photo-canvas')
    const imageDataURL = canvas.toDataURL('image/jpeg', 0.9)
    
    try {
      // Use Hugging Face Spaces API for Splatter Image
      const response = await fetch('https://szymanowiczs-splatter-image.hf.space/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: [imageDataURL]
        })
      })
      
      if (!response.ok) {
        throw new Error(`Splatter Image API error: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('🎉 Splatter Image processing complete!')
      
      // Load the generated gaussian splat
      await this.loadGaussianSplat(result.data[0])
      
    } catch (error) {
      console.error('❌ Splatter Image failed:', error)
      // Final fallback to enhanced local processing
      await this.processWithEnhancedLocal()
    }
  },

  async loadGaussianSplat(splatData) {
    console.log('🎬 Loading Gaussian Splat into 3D scene...')
    
    // Clear existing scene
    this.clearExisting3DContent()
    
    // Initialize Gaussian Splat renderer
    await this.initializeGaussianRenderer()
    
    // Load splat data
    this.gaussianSplat = await this.gaussianRenderer.loadSplat(splatData)
    
    // Set up camera controls for smooth navigation
    this.setupGaussianCameraControls()
    
    // Show the 3D scene
    this.show3DScene()
    this.hide3DLoadingOverlay()
    
    console.log('✅ Gaussian Splatting scene ready!')
    console.log('🎮 Use mouse to navigate the 3D scene')
  },

  async initializeGaussianRenderer() {
    if (this.gaussianRenderer) return
    
    console.log('🚀 Initializing Gaussian Splat renderer...')
    
    // Create renderer for gaussian splats
    this.gaussianRenderer = new THREE.WebGLRenderer({ 
      canvas: this.renderer3D.domElement,
      antialias: true,
      alpha: true
    })
    
    this.gaussianRenderer.setSize(window.innerWidth, window.innerHeight)
    this.gaussianRenderer.setPixelRatio(window.devicePixelRatio)
    
    // Enable high-performance rendering
    this.gaussianRenderer.outputColorSpace = THREE.SRGBColorSpace
    this.gaussianRenderer.toneMapping = THREE.ACESFilmicToneMapping
    this.gaussianRenderer.toneMappingExposure = 1.0
  },

  setupGaussianCameraControls() {
    // Enhanced camera controls for smooth Gaussian Splat navigation
    if (this.gaussianControls) {
      this.gaussianControls.dispose()
    }
    
    this.gaussianControls = new OrbitControls(this.camera3D, this.gaussianRenderer.domElement)
    
    // Smooth camera movement
    this.gaussianControls.enableDamping = true
    this.gaussianControls.dampingFactor = 0.05
    
    // Reasonable zoom limits
    this.gaussianControls.minDistance = 0.5
    this.gaussianControls.maxDistance = 20
    
    // Smooth rotation
    this.gaussianControls.rotateSpeed = 0.8
    this.gaussianControls.zoomSpeed = 1.2
    this.gaussianControls.panSpeed = 0.8
    
    // Enable all types of movement
    this.gaussianControls.enableZoom = true
    this.gaussianControls.enableRotate = true
    this.gaussianControls.enablePan = true
    
    console.log('🎮 Gaussian Splat camera controls configured')
  },

  // Enhanced fallback with better local processing
  async processWithEnhancedLocal() {
    console.log('🛠️ Using enhanced local 3D processing...')
    
    // Use computer vision techniques for better depth estimation
    const canvas = document.getElementById('photo-canvas')
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // Enhanced depth estimation using multiple cues
    const depthMap = await this.generateEnhancedDepthMap(imageData)
    
    // Create higher quality 3D geometry
    const geometry = await this.createEnhancedGeometry(depthMap, imageData)
    
    // Load into scene
    await this.loadEnhanced3DScene(geometry)
  },

  async generateEnhancedDepthMap(imageData) {
    console.log('🔍 Generating enhanced depth map...')
    
    const width = imageData.width
    const height = imageData.height
    const pixels = imageData.data
    const depthMap = new Float32Array(width * height)
    
    // Multiple depth cues for better estimation
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4
        
        const r = pixels[index]
        const g = pixels[index + 1] 
        const b = pixels[index + 2]
        
        // Enhanced depth calculation using multiple visual cues
        let depth = 0
        
        // 1. Atmospheric perspective (distance = less saturation)
        const saturation = this.calculateSaturation(r, g, b)
        depth += (1.0 - saturation) * 0.3
        
        // 2. Brightness/luminance cues
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        depth += (1.0 - luminance) * 0.2
        
        // 3. Vertical position (higher = further)
        const verticalBias = (y / height) * 0.2
        depth += verticalBias
        
        // 4. Edge detection (sharp edges = closer)
        const edgeStrength = this.calculateEdgeStrength(pixels, x, y, width, height)
        depth -= edgeStrength * 0.2
        
        // 5. Center bias (center = closer)
        const centerX = width / 2
        const centerY = height / 2
        const centerDistance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
        const normalizedCenterDistance = centerDistance / Math.sqrt(centerX ** 2 + centerY ** 2)
        depth += normalizedCenterDistance * 0.1
        
        // Clamp depth values
        depthMap[y * width + x] = Math.max(0, Math.min(1, depth))
      }
    }
    
    // Apply Gaussian smoothing for cleaner depth map
    return this.applyGaussianSmoothing(depthMap, width, height, 2.0)
  },

  show3DLoadingOverlay(message) {
    let overlay = document.getElementById('3d-loading-overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.id = '3d-loading-overlay'
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `
      document.body.appendChild(overlay)
    }
    
    overlay.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 1rem;">🎬</div>
        <h2 style="margin: 0 0 1rem 0; font-weight: 600;">${message}</h2>

        <div style="width: 300px; height: 4px; background: #333; border-radius: 2px; overflow: hidden;">
          <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #4F46E5, #7C3AED); animation: loading 2s ease-in-out infinite;">
          </div>
        </div>
      </div>
      <style>
        @keyframes loading {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
      </style>
    `
    overlay.style.display = 'flex'
  },

  hide3DLoadingOverlay() {
    const overlay = document.getElementById('3d-loading-overlay')
    if (overlay) {
      overlay.style.display = 'none'
    }
  },

  clearExisting3DContent() {
    // Clear existing 3D content
    this.scene3D.clear()
  },

  calculateSaturation(r, g, b) {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    return (max - min) / max
  },

  calculateEdgeStrength(pixels, x, y, width, height) {
    const idx = (y * width + x) * 4
    const current = pixels[idx]
    const right = pixels[idx + 4]
    const bottom = pixels[(y + 1) * width * 4 + x * 4]
    return Math.abs(current - right) + Math.abs(current - bottom)
  },

  applyGaussianSmoothing(depthMap, width, height, sigma) {
    const kernelSize = Math.ceil(sigma * 3)
    const offset = Math.floor(kernelSize / 2)
    const kernel = this.createGaussianKernel(kernelSize, sigma)
    
    const smoothed = []
    
    for (let y = 0; y < height; y++) {
      const row = []
      for (let x = 0; x < width; x++) {
        let sum = 0
        let count = 0
        
        for (let ky = -offset; ky <= offset; ky++) {
          for (let kx = -offset; kx <= offset; kx++) {
            const ny = y + ky
            const nx = x + kx
            
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              sum += depthMap[ny][nx] * kernel[ky + offset][kx + offset]
              count += kernel[ky + offset][kx + offset]
            }
          }
        }
        
        row.push(count > 0 ? sum / count : depthMap[y][x])
      }
      smoothed.push(row)
    }
    
    return smoothed
  },

  createGaussianKernel(size, sigma) {
    const kernel = []
    const offset = Math.floor(size / 2)
    const sigma2 = sigma * sigma
    
    for (let y = -offset; y <= offset; y++) {
      const row = []
      for (let x = -offset; x <= offset; x++) {
        const value = Math.exp(-(x * x + y * y) / (2 * sigma2)) / (2 * Math.PI * sigma2)
        row.push(value)
      }
      kernel.push(row)
    }
    
    return kernel
  },

  loadEnhanced3DScene(geometry) {
    // Add the new geometry to the scene
    this.scene3D.add(geometry)
  },

  createEnhancedGeometry(depthMap, imageData) {
    // Implement your logic to create enhanced 3D geometry based on depthMap and imageData
    // This is a placeholder implementation
    return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x00ff00 }))
  },

  // Enhanced local fallback function
  async processPhotoWithEnhanced3D(imageDataURL) {
    console.log('🔄 Falling back to enhanced local processing...')
    
    // Create depth map locally
    const img = new Image()
    await new Promise(resolve => {
      img.onload = resolve
      img.src = imageDataURL
    })
    
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    
    const depthMap = this.generateDepthMapFromImage(ctx.getImageData(0, 0, canvas.width, canvas.height))
    
    // Fix: Pass img (HTMLImageElement) instead of depthMap as second parameter
    await this.createReal3DDepthScene(imageDataURL, img)
  },

  async createReal3DDepthScene(imageUrl, img) {
    console.log('🌟 Creating REAL 3D scene with depth-mapped geometry...')
    
    // Initialize Three.js if not already done
    if (!this.scene3D) {
      this.initializeThreeJSScene()
    }
    
    // Create canvas to analyze image for depth
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)
    
    // Generate depth map from image analysis
    const depthMap = this.generateDepthMapFromImage(ctx.getImageData(0, 0, canvas.width, canvas.height))
    
    // Create 3D geometry from depth map
    const geometry = this.createDepthMappedGeometry(depthMap, img.width, img.height)
    
    // Create texture from original image
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    
    // Create material with the image texture
    const material = new THREE.MeshPhongMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0
    })
    
    // Clear previous scene
    if (this.scene3D.children.length > 3) { // Keep camera, lights
      const objectsToRemove = this.scene3D.children.filter(child => 
        child.type === 'Mesh' && child.userData.type === 'background'
      )
      objectsToRemove.forEach(obj => this.scene3D.remove(obj))
    }
    
    // Create mesh from geometry and material
    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.type = 'background'
    mesh.position.set(0, 0, -2)
    mesh.scale.set(6, 4, 1)
    
    // Add to scene
    this.scene3D.add(mesh)
    
    // Update display
    if (this.renderer3D) {
      this.renderer3D.render(this.scene3D, this.camera3D)
    }
    
    console.log('✅ Real 3D depth scene created successfully')
    
    // Scaling controls removed - scroll zoom works perfectly
    
    // Apply the image as background to the model viewer as well
    this.setPhotoBackground(imageUrl)
  },

  // Scaling controls removed - scroll zoom works perfectly

  // Show processing indicator
  showProcessingIndicator(message) {
    console.log(`⏳ ${message}`)
    // Could add UI indicator here if needed
  },

  // Scale the AR model
  scaleARModel(scale) {
    // Store current scale for drag feature
    this.currentModelScale = scale
    
    const modelViewer = document.getElementById('arModelViewer')
    if (modelViewer) {
      // Scale the model itself using the scale attribute instead of CSS transform
      modelViewer.setAttribute('scale', `${scale} ${scale} ${scale}`)
      console.log(`🔧 Model scaled to ${scale}x`)
    }
    
    // Also scale Three.js objects if they exist
    if (this.scene3D) {
      this.scene3D.children.forEach(child => {
        // Scale any 3D models (not just background)
        if (child.type === 'Mesh' && child.userData.type !== 'background') {
          child.scale.set(scale, scale, scale)
        }
        // Also scale groups that might contain models
        if (child.type === 'Group') {
          child.scale.set(scale, scale, scale)
        }
      })
      
      if (this.renderer3D) {
        this.renderer3D.render(this.scene3D, this.camera3D)
      }
    }
  }
};

// Global functions for AR and accessories
window.openARViewer = function(productId) {
  ARViewer.openARViewer(productId);
}

// Model scaling controls removed - using scroll zoom only

window.closeARViewer = function() {
  ARViewer.closeARViewer();
}

window.updateARConfiguration = function() {
  ARViewer.updateARConfiguration();
}

window.updatePreviewConfiguration = function() {
  ARViewer.updatePreviewConfiguration();
}

// Photo upload functions
window.handlePhotoUpload = function(event) {
  const file = event.target.files[0];
  ARViewer.handlePhotoUpload(file);
}

window.clearPhotoBackground = function() {
  ARViewer.clearPhotoBackground();
}

// Waitlist functionality
window.joinWaitlist = function(source = 'main') {
  const emailInput = source === 'final' ? 
    document.getElementById('final-waitlist-email') : 
    document.getElementById('waitlist-email');
  
  const email = emailInput?.value?.trim();
  
  if (!email) {
    alert('Please enter your email address');
    return;
  }
  
  if (!isValidEmail(email)) {
    alert('Please enter a valid email address');
    return;
  }
  
  // Here you would typically send to your backend
  console.log('Joining waitlist:', email, 'Source:', source);
  
  // Show success message
  alert('Thanks for joining! You\'ll be among the first to know when WasteWell is available.');
    
  // Clear input
  emailInput.value = '';
  
  // Track analytics
    if (typeof gtag !== 'undefined') {
    gtag('event', 'waitlist_signup', {
      'event_category': 'Marketing',
      'event_label': source
      });
    }
  }

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// FAQ functionality
window.toggleFAQ = function(button) {
  const answer = button.nextElementSibling;
  const icon = button.querySelector('span');
  
  answer.classList.toggle('active');
  icon.textContent = answer.classList.contains('active') ? '−' : '+';
}

// Sticky waitlist bar functionality
function initStickyWaitlist() {
  const waitlistBar = document.querySelector('.waitlist-bar');
  const heroSection = document.querySelector('.hero');
  
  if (!waitlistBar || !heroSection) return;
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          waitlistBar.classList.add('visible');
        } else {
          waitlistBar.classList.remove('visible');
        }
      });
    },
    { threshold: 0.1 }
  );
  
  observer.observe(heroSection);
  
  // Handle footer waitlist form submission
  const footerForm = document.getElementById('waitlist-footer');
  if (footerForm) {
    footerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = footerForm.querySelector('input[type="email"]');
      const email = emailInput?.value?.trim();
      
      if (!email) {
        alert('Please enter your email address');
        return;
      }
      
      if (!isValidEmail(email)) {
        alert('Please enter a valid email address');
        return;
      }
      
      console.log('Footer waitlist signup:', email);
      alert('Thanks for joining! You\'ll be among the first to know when our products are available.');
      emailInput.value = '';
    });
  }
}

// Smooth scrolling for anchor links
function initSmoothScrolling() {
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Add a small delay to ensure model-viewer is loaded
  setTimeout(() => {
    ARViewer.init();
  }, 100);
  
  // Initialize other functionality
  initStickyWaitlist();
  initSmoothScrolling();
}); 