import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { HalfFloatType, Vector2, WebGLRenderTarget } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Broadcast-camera look: a light saturation lift and a soft vignette, in linear light
// before the OutputPass applies tone mapping and sRGB.
const Grade = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.3 }, saturation: { value: 1.08 } },
  vertexShader:
    "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader:
    "uniform sampler2D tDiffuse; uniform float vignette; uniform float saturation; varying vec2 vUv;" +
    "void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));" +
    "c.rgb = max(mix(vec3(l), c.rgb, saturation), 0.0); vec2 d = vUv - 0.5; c.rgb *= 1.0 - vignette * dot(d, d) * 1.6;" +
    "gl_FragColor = c; }",
};

/**
 * High quality only: renders the scene through a composer (multisampled, half-float) with a
 * gentle bloom on the brightest highlights (sun, glints on paint), the grade and the output
 * pass. Taking frame priority 1 replaces R3F's own render, so the scene is drawn once.
 */
export default function Effects() {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, target);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new Vector2(256, 256), 0.22, 0.45, 0.95));
    c.addPass(new ShaderPass(Grade));
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera]);
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size]);
  useEffect(() => () => composer.dispose(), [composer]);
  useFrame(() => composer.render(), 1);
  return null;
}
