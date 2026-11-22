import { type ShaderComponentProps } from '../shader-mount.js';
import { type LensDistortionParams, type ImageShaderPreset } from '@paper-design/shaders';
export interface LensDistortionProps extends ShaderComponentProps, LensDistortionParams {
}
type LensDistortionPreset = ImageShaderPreset<LensDistortionParams>;
export declare const defaultPreset: LensDistortionPreset;
export declare const fisheyePreset: LensDistortionPreset;
export declare const duotonePreset: LensDistortionPreset;
export declare const smokePreset: LensDistortionPreset;
export declare const lensDistortionPresets: LensDistortionPreset[];
export declare const LensDistortion: React.FC<LensDistortionProps>;
export {};
