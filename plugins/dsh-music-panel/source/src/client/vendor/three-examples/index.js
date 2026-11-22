// three.js examples used by the machi engine. These are real implementations (three
// 0.170 examples + the 0.185 FXAAPass), not inert stubs: the engine's post-processing
// chain needs EffectComposer/UnrealBloomPass to actually render.
export { FullScreenQuad, Pass } from './postprocessing/Pass.js'
export { EffectComposer } from './postprocessing/EffectComposer.js'
export { RenderPass } from './postprocessing/RenderPass.js'
export { ShaderPass } from './postprocessing/ShaderPass.js'
export { UnrealBloomPass } from './postprocessing/UnrealBloomPass.js'
export { FXAAPass } from './postprocessing/FXAAPass.js'
export { SMAAPass } from './postprocessing/SMAAPass.js'
export { OrbitControls } from './controls/OrbitControls.js'
export { RoundedBoxGeometry } from './geometries/RoundedBoxGeometry.js'
export { mergeGeometries, mergeVertices } from './utils/BufferGeometryUtils.js'
export default {}
