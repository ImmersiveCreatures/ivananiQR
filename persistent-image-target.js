// Replacement for xrextras-named-image-target that keeps the content in place when the
// image is lost. World tracking (SLAM, on by default in xrweb) keeps moving the camera, so
// the content stays anchored where the image was seen last instead of disappearing on
// every fast camera move. Small corrections from the image tracker are eased to hide
// jitter; large ones (the image seen again after drifting) snap.
AFRAME.registerComponent('persistent-image-target', {
  schema: {
    name: {type: 'string'},
    // Fraction of the remaining distance covered per frame at 60 fps (0 = no smoothing).
    smoothing: {type: 'number', default: 0.3},
    // Corrections larger than this, in image heights, snap instead of easing.
    snapDistance: {type: 'number', default: 0.5},
  },

  init() {
    const object3D = this.el.object3D
    const scene = this.el.sceneEl

    this.targetPosition = new THREE.Vector3()
    this.targetRotation = new THREE.Quaternion()
    this.targetScale = 1
    this.placed = false
    object3D.visible = false

    this.onRealityReady = () => {
      if (!this.placed) object3D.visible = false
    }

    this.onUpdated = ({detail}) => {
      if (detail.name !== this.data.name) return
      this.targetPosition.copy(detail.position)
      this.targetRotation.copy(detail.rotation)
      this.targetScale = detail.scale

      const jump = object3D.position.distanceTo(this.targetPosition)
      if (!this.placed || !this.data.smoothing || jump > this.data.snapDistance * detail.scale) {
        object3D.position.copy(this.targetPosition)
        object3D.quaternion.copy(this.targetRotation)
        object3D.scale.setScalar(this.targetScale)
      }
    }

    this.onFound = (event) => {
      if (event.detail.name !== this.data.name) return
      this.onUpdated(event)
      this.placed = true
      object3D.visible = true
      this.el.emit('xrextrasfound', {}, false)
    }

    this.onLost = ({detail}) => {
      if (detail.name !== this.data.name) return
      // Keep showing the content: SLAM keeps it anchored in the room.
      this.el.emit('xrextraslost', {}, false)
    }

    scene.addEventListener('realityready', this.onRealityReady)
    scene.addEventListener('xrimagefound', this.onFound)
    scene.addEventListener('xrimageupdated', this.onUpdated)
    scene.addEventListener('xrimagelost', this.onLost)
  },

  tick(time, delta) {
    if (!this.placed || !this.data.smoothing || !delta) return
    const object3D = this.el.object3D
    const k = 1 - Math.pow(1 - this.data.smoothing, delta / (1000 / 60))
    object3D.position.lerp(this.targetPosition, k)
    object3D.quaternion.slerp(this.targetRotation, k)
    const scale = object3D.scale.x + (this.targetScale - object3D.scale.x) * k
    object3D.scale.setScalar(scale)
  },

  remove() {
    const scene = this.el.sceneEl
    scene.removeEventListener('realityready', this.onRealityReady)
    scene.removeEventListener('xrimagefound', this.onFound)
    scene.removeEventListener('xrimageupdated', this.onUpdated)
    scene.removeEventListener('xrimagelost', this.onLost)
  },
})
