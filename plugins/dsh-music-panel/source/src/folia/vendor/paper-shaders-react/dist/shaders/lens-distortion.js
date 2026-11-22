/* * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                    Paper Shaders                    *
 *       https://github.com/paper-design/shaders       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * */

import { memo, forwardRef } from "react";
import { ShaderMount } from "../shader-mount.js";
import { colorPropsAreEqual } from "../color-props-are-equal.js";
import {
  lensDistortionFragmentShader,
  ShaderFitOptions,
  defaultObjectSizing
} from "@paper-design/shaders";
import { jsx } from "react/jsx-runtime";
const defaultPreset = {
  name: "Default",
  params: {
    ...defaultObjectSizing,
    scale: 1,
    fit: "contain",
    speed: 0,
    frame: 0,
    spread: 0.6,
    bias: 1,
    angle: 0,
    perspective: 0.1,
    count: 35,
    dispersion: 1,
    dispersionShift: 0,
    dispersionColor: 0.6,
    focusCenter: 0.8,
    focusEdges: 1,
    swirl: 0.35,
    noise: 0,
    noiseFrequency: 0.25,
    noiseOffset: 0,
    lensBulge: 0,
    lensCircle: 0,
    grainMixer: 0,
    grainOverlay: 0,
    imageX: 0,
    imageY: 0
  }
};
const fisheyePreset = {
  name: "Fisheye",
  params: {
    ...defaultObjectSizing,
    scale: 1,
    fit: "contain",
    speed: 0,
    frame: 0,
    spread: 0.7,
    bias: 1,
    angle: 0,
    perspective: 0.75,
    count: 15,
    dispersion: 1,
    dispersionShift: 0,
    dispersionColor: 0.7,
    focusCenter: 0.9,
    focusEdges: 1,
    swirl: 1,
    noise: 0,
    noiseFrequency: 0.25,
    noiseOffset: 0,
    lensBulge: 0.95,
    lensCircle: 1,
    grainMixer: 0.5,
    grainOverlay: 0,
    imageX: 0,
    imageY: 0
  }
};
const duotonePreset = {
  name: "Duotone",
  params: {
    ...defaultObjectSizing,
    fit: "contain",
    speed: 0,
    frame: 0,
    spread: 0.1,
    bias: 0,
    angle: 0,
    perspective: 0,
    count: 2,
    dispersion: 1,
    dispersionShift: 0,
    dispersionColor: 0.1,
    focusCenter: 0,
    focusEdges: 0,
    swirl: 0,
    noise: 0,
    noiseFrequency: 0.25,
    noiseOffset: 0,
    lensBulge: 0,
    lensCircle: 0,
    grainMixer: 0.1,
    grainOverlay: 0.3,
    imageX: 0,
    imageY: 0
  }
};
const smokePreset = {
  name: "Smoke",
  params: {
    ...defaultObjectSizing,
    scale: 1,
    fit: "contain",
    speed: 0,
    frame: 0,
    spread: 0.65,
    bias: -1,
    angle: 0,
    perspective: 0.4,
    count: 50,
    dispersion: 0,
    dispersionShift: 0,
    dispersionColor: 0.31,
    focusCenter: 0,
    focusEdges: 0.6,
    swirl: 0,
    noise: 1,
    noiseFrequency: 0.35,
    noiseOffset: 0.3,
    lensBulge: 0,
    lensCircle: 0,
    grainMixer: 0,
    grainOverlay: 0,
    imageX: 0,
    imageY: 0
  }
};
const lensDistortionPresets = [
  defaultPreset,
  fisheyePreset,
  duotonePreset,
  smokePreset
];
const LensDistortion = memo(forwardRef(function LensDistortionImpl({
  // Own props
  speed = defaultPreset.params.speed,
  frame = defaultPreset.params.frame,
  image = "",
  spread = defaultPreset.params.spread,
  bias = defaultPreset.params.bias,
  angle = defaultPreset.params.angle,
  perspective = defaultPreset.params.perspective,
  count = defaultPreset.params.count,
  dispersion = defaultPreset.params.dispersion,
  dispersionShift = defaultPreset.params.dispersionShift,
  dispersionColor = defaultPreset.params.dispersionColor,
  focusCenter = defaultPreset.params.focusCenter,
  focusEdges = defaultPreset.params.focusEdges,
  swirl = defaultPreset.params.swirl,
  noise = defaultPreset.params.noise,
  noiseFrequency = defaultPreset.params.noiseFrequency,
  noiseOffset = defaultPreset.params.noiseOffset,
  lensBulge = defaultPreset.params.lensBulge,
  lensCircle = defaultPreset.params.lensCircle,
  grainMixer = defaultPreset.params.grainMixer,
  grainOverlay = defaultPreset.params.grainOverlay,
  imageX = defaultPreset.params.imageX,
  imageY = defaultPreset.params.imageY,
  // Sizing props
  fit = defaultPreset.params.fit,
  scale = defaultPreset.params.scale,
  rotation = defaultPreset.params.rotation,
  originX = defaultPreset.params.originX,
  originY = defaultPreset.params.originY,
  offsetX = defaultPreset.params.offsetX,
  offsetY = defaultPreset.params.offsetY,
  worldWidth = defaultPreset.params.worldWidth,
  worldHeight = defaultPreset.params.worldHeight,
  ...props
}, ref) {
  const uniforms = {
    // Own uniforms
    u_image: image,
    u_spread: spread,
    u_bias: bias,
    u_angle: angle,
    u_perspective: perspective,
    u_count: count,
    u_dispersion: dispersion,
    u_dispersionShift: dispersionShift,
    u_dispersionColor: dispersionColor,
    u_focusCenter: focusCenter,
    u_focusEdges: focusEdges,
    u_swirl: swirl,
    u_noise: noise,
    u_noiseFrequency: noiseFrequency,
    u_noiseOffset: noiseOffset,
    u_lensBulge: lensBulge,
    u_lensCircle: lensCircle,
    u_grainMixer: grainMixer,
    u_grainOverlay: grainOverlay,
    u_imageX: imageX,
    u_imageY: imageY,
    // Sizing uniforms
    u_fit: ShaderFitOptions[fit],
    u_rotation: rotation,
    u_scale: scale,
    u_offsetX: offsetX,
    u_offsetY: offsetY,
    u_originX: originX,
    u_originY: originY,
    u_worldWidth: worldWidth,
    u_worldHeight: worldHeight
  };
  return /* @__PURE__ */ jsx(
    ShaderMount,
    {
      ...props,
      ref,
      speed,
      frame,
      fragmentShader: lensDistortionFragmentShader,
      mipmaps: ["u_image"],
      uniforms
    }
  );
}), colorPropsAreEqual);
export {
  LensDistortion,
  defaultPreset,
  duotonePreset,
  fisheyePreset,
  lensDistortionPresets,
  smokePreset
};
//# sourceMappingURL=lens-distortion.js.map
