const vertexShaderSource = `
    attribute vec4 aVertexPosition;
    void main() {
        gl_Position = aVertexPosition;
    }
`;

const waveParams = {
    wavelength: 0.05,
    frequency: 10.0,
    amplitude: 1.0,
    velocity: 2.0,    // Changed from 5.0 to 2.0
    distanceDecay: 2.0,
    fadeTime: 7.0
};

const fragmentShaderSource = `
    precision highp float;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec2 uMousePoints[10];
    uniform float uPointTimes[10];
    uniform int uNumPoints;
    uniform float uWavelength;
    uniform float uFrequency;
    uniform float uAmplitude;
    uniform float uVelocity;
    uniform float uDistanceDecay;
    uniform float uFadeTime;

    float calculateWave(vec2 uv, vec2 point, float time, float timeSinceClick) {
        float aspect = uResolution.x / uResolution.y;
        point.x *= aspect;
        float dist = distance(uv, point);
        
        float phase = (dist / uWavelength) - (time * uVelocity);
        float distanceDecay = exp(-dist * uDistanceDecay);
        float timeDecay = clamp(1.0 - (timeSinceClick / uFadeTime), 0.0, 1.0);
        
        return uAmplitude * sin(phase * uFrequency) * distanceDecay * timeDecay;
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / uResolution;
        float aspect = uResolution.x / uResolution.y;
        uv.x *= aspect;
        
        float totalWave = 0.0;
        float numWaves = 0.0;
        
        for(int i = 0; i < 10; i++) {
            if(i >= uNumPoints) break;
            
            float timeSinceClick = uTime - uPointTimes[i];
            float wave = calculateWave(uv, uMousePoints[i], uTime, timeSinceClick);
            totalWave += wave;
            numWaves += 1.0;
        }
        
        // Calculate interference pattern
        float interference = totalWave / (numWaves + 0.001);
        
        // Normalize and enhance contrast
        float finalIntensity = 0.5 + 0.5 * interference;
        finalIntensity = clamp(finalIntensity, 0.0, 1.0);
        
        gl_FragColor = vec4(vec3(finalIntensity), 1.0);
    }
`;

let gl;
let program;
let mousePoints = [];
let pointTimes = [];
let timeLocation;
let resolutionLocation;
let mousePointsLocation;
let pointTimesLocation;
let numPointsLocation;

function initGL() {
    const canvas = document.getElementById('glCanvas');
    gl = canvas.getContext('webgl');

    if (!gl) {
        alert('WebGL not supported');
        return;
    }

    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
        console.error("Shader creation failed");
        return;
    }

    // Create program
    program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) {
        console.error("Program creation failed");
        return;
    }

    // Set up attributes and uniforms
    const positionBuffer = gl.createBuffer();
    const positions = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0,
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'aVertexPosition');
    timeLocation = gl.getUniformLocation(program, 'uTime');
    resolutionLocation = gl.getUniformLocation(program, 'uResolution');
    mousePointsLocation = gl.getUniformLocation(program, 'uMousePoints');
    pointTimesLocation = gl.getUniformLocation(program, 'uPointTimes');
    numPointsLocation = gl.getUniformLocation(program, 'uNumPoints');

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set up canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Add click listener
    canvas.addEventListener('click', handleClick);

    // Add these uniform locations
    const uniformLocations = {
        wavelength: gl.getUniformLocation(program, 'uWavelength'),
        frequency: gl.getUniformLocation(program, 'uFrequency'),
        amplitude: gl.getUniformLocation(program, 'uAmplitude'),
        velocity: gl.getUniformLocation(program, 'uVelocity'),
        distanceDecay: gl.getUniformLocation(program, 'uDistanceDecay'),
        fadeTime: gl.getUniformLocation(program, 'uFadeTime')
    };

    // Store uniform locations
    Object.assign(window, { uniformLocations });

    // Initialize GUI
    initGui();

    // Start render loop
    render();
}

function initGui() {
    const gui = new dat.GUI();
    gui.add(waveParams, 'wavelength', 0.01, 0.2).name('Wave Length');
    gui.add(waveParams, 'frequency', 1, 50).name('Frequency');
    gui.add(waveParams, 'amplitude', 0.1, 2).name('Amplitude');
    gui.add(waveParams, 'velocity', 0.5, 5).name('Velocity');    // Changed range from (1, 20) to (0.5, 5)
    gui.add(waveParams, 'distanceDecay', 0.1, 5).name('Distance Decay');
    gui.add(waveParams, 'fadeTime', 1, 15).name('Fade Time');
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) {
        console.error("Failed to create shader");
        return null;
    }
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    if (!vertexShader || !fragmentShader) {
        console.error("Invalid shaders");
        return null;
    }

    const program = gl.createProgram();
    if (!program) {
        console.error("Failed to create program");
        return null;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

function resizeCanvas() {
    const canvas = gl.canvas;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

function handleClick(event) {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const canvas = gl.canvas;
    
    // Correct the point position for aspect ratio
    mousePoints.push([x / canvas.width, 1.0 - y / canvas.height]);
    pointTimes.push(performance.now() / 1000);
    
    if (mousePoints.length > 10) {
        mousePoints.shift();
        pointTimes.shift();
    }
}

function render() {
    gl.useProgram(program);
    
    const currentTime = performance.now() / 1000;
    
    // Remove points older than 7 seconds
    while (mousePoints.length > 0 && currentTime - pointTimes[0] > 7.0) {
        mousePoints.shift();
        pointTimes.shift();
    }
    
    // Update uniforms
    gl.uniform1f(timeLocation, currentTime);
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
    
    const flatPoints = new Float32Array(mousePoints.flat());
    gl.uniform2fv(mousePointsLocation, flatPoints);
    gl.uniform1fv(pointTimesLocation, new Float32Array(pointTimes));
    gl.uniform1i(numPointsLocation, mousePoints.length);

    // Update wave parameter uniforms
    gl.uniform1f(uniformLocations.wavelength, waveParams.wavelength);
    gl.uniform1f(uniformLocations.frequency, waveParams.frequency);
    gl.uniform1f(uniformLocations.amplitude, waveParams.amplitude);
    gl.uniform1f(uniformLocations.velocity, waveParams.velocity);
    gl.uniform1f(uniformLocations.distanceDecay, waveParams.distanceDecay);
    gl.uniform1f(uniformLocations.fadeTime, waveParams.fadeTime);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
}

// Initialize when the page loads
window.onload = initGL;
