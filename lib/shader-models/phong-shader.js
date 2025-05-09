import { createProgram } from "../third-party/cuon-utils.js";
import { getAttrib, getUniform } from "../utils.js";
import { Vector3, Matrix4 } from "./../third-party/cuon-matrix-cse160.js";
import { initTextures } from "../texture.js";
import { debugLog } from "../utils.js";

const debugkey = "shader_models_phong_shader";

debugLog(debugkey, "Loading shader_models_phong_shader...");

/**
 * Represents a Phong shader for rendering 3D objects with lighting.
 */
export class PhongShader {
  constructor(gl) {
    this.gl = gl;
    this.program = null;

    this.shaderVars = {
      attribs: {
        a_Position: null,
        a_UV: null,
        a_Normal: null,

      },
      uniforms: {
        u_Size: null,
        u_CameraPos: null,
        u_FragColor: null,
        u_ModelMatrix: null,
        u_NormalMatrix: null,
        u_ViewMatrix: null,
        u_ProjectionMatrix: null,
        u_Sampler0: null,
        u_Sampler1: null,
        u_Sampler2: null,
        u_Sampler3: null,

        u_whichTexture: null,
        u_PointLightPos: null,
        u_PointLightColor: null,
        u_PointLightStatus: null,
        u_NumPointLights: null,

        u_ambientLightFactor: null,
        u_diffuseLightFactor: null,
        u_specularLightFactor: null,
        u_specularExponent: null,

        u_ShapeType: null,
        u_Center: null,
        u_Radius: null,
        u_ShapeType2: null,
        fallOffStart: null,
        fallOffEnd: null,
        fallOffStepExponent: null,
      },
    };
  }

  /**
   * Sets up the program by compiling the vertex and fragment shaders, creating the program,
   * and retrieving the attribute and uniform locations.
   */
  setProgram() {
    const gl = this.gl;
    this.vertexShader = `#version 300 es
    precision mediump float;

    layout(location = 0) in vec4 a_Position;
    in vec2 a_UV;
    in vec3 a_Normal;

    uniform int u_ShapeType;
    uniform mat4 u_ModelMatrix;
    uniform mat4 u_NormalMatrix;
    uniform mat4 u_ViewMatrix;
    uniform mat4 u_ProjectionMatrix;
    uniform vec3 u_CameraPos;
    uniform float u_Size;

    uniform vec3 u_Center;  // Center of the circle
    uniform vec3 u_Radius; // Radius of the circle

    out vec4 v_VertPos;
    out vec2 v_UV;
    out vec3 v_Normal;
    out vec3 v_CameraPos;

    void main() {
        gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
        v_Normal = (u_NormalMatrix * vec4(a_Normal, 1.0)).xyz;
        v_VertPos = u_ModelMatrix * a_Position;
        v_CameraPos = u_CameraPos;
        gl_PointSize = u_Size;

        // circle
        if (u_ShapeType == 1 || u_ShapeType == 9) {
            vec3 data = (a_Position.xyz - u_Center) / u_Radius;
            v_UV = vec2(data.x, data.y);
        } else {
            v_UV = a_UV;
        }
    }
    `;

    this.fragmentShader = `#version 300 es
    precision mediump float;

    const int MAX_POINT_LIGHTS = 4;

    uniform int u_ShapeType2;
    uniform vec3 u_PointLightPos[MAX_POINT_LIGHTS];
    uniform vec3 u_PointLightColor[MAX_POINT_LIGHTS];
    uniform int u_PointLightStatus[MAX_POINT_LIGHTS];
    uniform int u_NumPointLights;
    uniform float u_ambientLightFactor;
    uniform float u_diffuseLightFactor;
    uniform float u_specularLightFactor;
    uniform float u_specularExponent;

    uniform vec4 u_FragColor;  // frag color, default is 0.5,0.5,0.5,1.0 

    uniform sampler2D u_Sampler0;
    uniform sampler2D u_Sampler1;
    uniform sampler2D u_Sampler2;
    uniform sampler2D u_Sampler3;

    uniform int u_whichTexture;
    uniform float fallOffStart;
    uniform float fallOffEnd;
    uniform float fallOffStepExponent;

    in vec3 v_Normal;
    in vec4 v_VertPos;
    in vec2 v_UV;
    in vec3 v_CameraPos;

    out vec4 fragColor;

    void main() {
        if (u_ShapeType2 == 1 || u_ShapeType2 == 9) {
            float dist = length(v_UV); // distance from center (0.0 to ~1.0)
            float falloff = smoothstep(fallOffStart, fallOffEnd, dist * fallOffStepExponent); // smooth falloff from center to edge
            fragColor = vec4(u_FragColor.rgb, u_FragColor.a * falloff); // Apply alpha falloff
            return;
        } else {
            if (u_whichTexture == -6) {
                fragColor = vec4(0.0, 0.0, 0.0, 1.0); 
            } else if (u_whichTexture == -5) {
                fragColor = vec4(1.0, 1.0, 0.0, 1.0); 
            } else if (u_whichTexture == -4) {
                vec3 norm = normalize(v_Normal);
                fragColor = vec4(norm, 1.0);
            } else if (u_whichTexture == -3) {
                fragColor = vec4((v_Normal + 1.0) / 2.0, 1.0);
            } else if (u_whichTexture == -2) {
                fragColor = u_FragColor;
            } else if (u_whichTexture == -1) {
                fragColor = vec4(v_UV, 1.0, 1.0);
            } else if (u_whichTexture == 0) {
                fragColor = texture(u_Sampler0, v_UV);
            } else if (u_whichTexture == 1) {
                fragColor = texture(u_Sampler1, v_UV);
            } else if (u_whichTexture == 2) {
                fragColor = texture(u_Sampler2, v_UV);
            } else if (u_whichTexture == 3) {
                fragColor = texture(u_Sampler3, v_UV);
            } else {
                fragColor = vec4(1, 0.2, 0.2, 1);
            }
        }

        vec3 finalLighting = vec3(fragColor) * u_ambientLightFactor; // Ambient

        vec3 N = normalize(v_Normal);
        vec3 E = normalize(v_CameraPos - vec3(v_VertPos));
        
        for (int i = 0; i < MAX_POINT_LIGHTS; ++i) {
            if (i >= u_NumPointLights) break;
            if (u_PointLightStatus[i] != 1) continue;
        
            vec3 L = normalize(u_PointLightPos[i] - vec3(v_VertPos));
            float nDotL = max(dot(N, L), 0.0);
        
            vec3 R = reflect(-L, N);
            float specular = pow(max(dot(E, R), 0.0), u_specularExponent) * u_specularLightFactor;
        
            vec3 diffuse = u_PointLightColor[i] * vec3(fragColor) * nDotL * u_diffuseLightFactor;
        
            finalLighting += diffuse + specular;
        }

        fragColor = vec4(finalLighting, 1.0);
    }
    `;

    this.program = createProgram(this.gl, this.vertexShader, this.fragmentShader);
    if (!this.program) {
      console.log("Failed to create program");
      return false;
    }

    gl.useProgram(this.program);
    this.shaderVars.attribs.a_UV = getAttrib(gl, this.program, "a_UV");
    this.shaderVars.attribs.a_Normal = getAttrib(gl, this.program, "a_Normal");

    this.shaderVars.uniforms.u_Size = getUniform(gl, this.program, "u_Size");
    this.shaderVars.uniforms.u_CameraPos = getUniform(gl, this.program, "u_CameraPos");
    this.shaderVars.uniforms.u_FragColor = getUniform(gl, this.program, "u_FragColor");
    this.shaderVars.uniforms.u_whichTexture = getUniform(gl, this.program, "u_whichTexture");
    this.shaderVars.uniforms.u_ModelMatrix = getUniform(gl, this.program, "u_ModelMatrix");
    this.shaderVars.uniforms.u_NormalMatrix = getUniform(gl, this.program, "u_NormalMatrix");
    this.shaderVars.uniforms.u_ViewMatrix = getUniform(gl, this.program, "u_ViewMatrix");
    this.shaderVars.uniforms.u_ProjectionMatrix = getUniform(gl, this.program, "u_ProjectionMatrix");
    this.shaderVars.uniforms.u_Sampler0 = getUniform(gl, this.program, "u_Sampler0");
    this.shaderVars.uniforms.u_Sampler1 = getUniform(gl, this.program, "u_Sampler1");
    this.shaderVars.uniforms.u_Sampler2 = getUniform(gl, this.program, "u_Sampler2");
    this.shaderVars.uniforms.u_Sampler3 = getUniform(gl, this.program, "u_Sampler3");

    this.shaderVars.uniforms.u_PointLightPos = getUniform(gl, this.program, "u_PointLightPos[0]");
    this.shaderVars.uniforms.u_PointLightColor = getUniform(gl, this.program, "u_PointLightColor[0]");
    this.shaderVars.uniforms.u_PointLightStatus = getUniform(gl, this.program, "u_PointLightStatus[0]");
    this.shaderVars.uniforms.u_NumPointLights = getUniform(gl, this.program, "u_NumPointLights");

    this.shaderVars.uniforms.u_ambientLightFactor = getUniform(gl, this.program, "u_ambientLightFactor");
    this.shaderVars.uniforms.u_diffuseLightFactor = getUniform(gl, this.program, "u_diffuseLightFactor");
    this.shaderVars.uniforms.u_specularLightFactor = getUniform(gl, this.program, "u_specularLightFactor");
    this.shaderVars.uniforms.u_specularExponent = getUniform(gl, this.program, "u_specularExponent");
    this.shaderVars.uniforms.u_ShapeType = getUniform(gl, this.program, "u_ShapeType");
    this.shaderVars.uniforms.u_ShapeType2 = getUniform(gl, this.program, "u_ShapeType2");
    this.shaderVars.uniforms.u_Center = getUniform(gl, this.program, "u_Center");
    this.shaderVars.uniforms.u_Radius = getUniform(gl, this.program, "u_Radius");
    this.shaderVars.uniforms.fallOffStart = getUniform(gl, this.program, "fallOffStart");
    this.shaderVars.uniforms.fallOffEnd = getUniform(gl, this.program, "fallOffEnd");
    this.shaderVars.uniforms.fallOffStepExponent = getUniform(gl, this.program, "fallOffStepExponent");
    
    // console.log(this.shaderVars.uniforms.u_CameraPos, this.shaderVars.uniforms.u_FragColor, this.shaderVars.uniforms.u_whichTexture);
    // Identity Model Matrix
    const identityM = new Matrix4();
    this.gl.uniformMatrix4fv(this.shaderVars.uniforms.u_ModelMatrix, false, identityM.elements);
    // console.log("Loading textures...");
    const basePath = new URL('.', import.meta.url).href;
    initTextures(this.gl, [
      { url: basePath + "./../assets/uvCoords.png", unit: 0, sampler: this.shaderVars.uniforms.u_Sampler0 },
      { url: basePath + "./../assets/dice.png", unit: 1, sampler: this.shaderVars.uniforms.u_Sampler1 },
      { url: basePath + "./../assets/texture.png", unit: 2, sampler: this.shaderVars.uniforms.u_Sampler2 },
      { url: basePath + "./../assets/scan/george-washington-greenough-statue-(1840)-150k-4096-diffuse.jpg", unit: 3, sampler: this.shaderVars.uniforms.u_Sampler3 },
    ]);
  }

  use() {
    this.gl.useProgram(this.program);
  }

  setUniforms(scene, camera) {
    const gl = this.gl;
    if (!this.program) this.setProgram();
    this.use();
    // Check if the program is correctly set before setting uniforms
    const activeProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM);
    if (activeProgram !== this.program) {
      console.error("Incorrect program active when setting uniforms!");
    }
    // console.log(camera.eye.elements)
    gl.uniform3f(this.shaderVars.uniforms.u_CameraPos, camera.eye.elements[0], camera.eye.elements[1], camera.eye.elements[2]);
    gl.uniformMatrix4fv(this.shaderVars.uniforms.u_ViewMatrix, false, camera.viewMatrix.elements);
    gl.uniformMatrix4fv(this.shaderVars.uniforms.u_ProjectionMatrix, false, camera.projectionMatrix.elements);

    const MAX_LIGHTS = 4;
    if (scene.pointLights.length > MAX_LIGHTS) {
      console.warn(`Only first ${MAX_LIGHTS} lights will be used. (${scene.pointLights.length} provided)`);
    }

    const lights = scene.pointLights.slice(0, MAX_LIGHTS);

    gl.uniform1i(this.shaderVars.uniforms.u_NumPointLights, lights.length);

    const posArray = [],
      colorArray = [],
      statusArray = [];

    lights.forEach((light) => {
      posArray.push(...light.pos);
      colorArray.push(...light.color);
      statusArray.push(light.status);
      light.cube.matrix.setTranslate(light.pos[0], light.pos[1], light.pos[2]);
      light.cube.render(this.shaderVars, scene.normalControllerState);
    });

    gl.uniform3fv(this.shaderVars.uniforms.u_PointLightPos, posArray);
    gl.uniform3fv(this.shaderVars.uniforms.u_PointLightColor, colorArray);
    gl.uniform1iv(this.shaderVars.uniforms.u_PointLightStatus, statusArray);

    gl.uniform1f(this.shaderVars.uniforms.u_ambientLightFactor, scene.ambientLightFactor);
    gl.uniform1f(this.shaderVars.uniforms.u_diffuseLightFactor, scene.diffuseLightFactor);
    gl.uniform1f(this.shaderVars.uniforms.u_specularLightFactor, scene.specularLightFactor);
    gl.uniform1f(this.shaderVars.uniforms.u_specularExponent, scene.specularExponent);

    gl.uniform1f(this.shaderVars.uniforms.fallOffStart, scene.fallOffStart);
    gl.uniform1f(this.shaderVars.uniforms.fallOffEnd, scene.fallOffEnd);
    gl.uniform1f(this.shaderVars.uniforms.fallOffStepExponent, scene.fallOffStepExponent);
  }

  render(shape, normalControllerState) {
    shape.render(this.shaderVars, normalControllerState);
  }
}
