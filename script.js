// --- Configuration ---
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUIDS = {
    heel: "beb5483e-36e1-4688-b7f5-ea07361b26a8",
    arch: "c8c3a818-3599-4e58-a92d-7c27a29e604f",
    ball: "218e832e-5614-41e2-a747-83d3e38117a0",
    toe:  "00192e4d-2d85-4389-a299-1389af2a4019"
};

// --- ALIGNMENT FIX ---
// Sensor positions optimized for ORIGINAL IMAGE SIZE (300x600px)
// Adjusted for proper foot anatomy alignment
const SENSOR_POSITIONS = {
    heel: { x: 50, y: 85 },        // Bottom center of foot
    arch: { x: 45, y: 55 },        // Medial (inner) arch area - moved 10% right from 35
    ball: { x: 40, y: 28 },        // Ball of foot area - moved 5% left from 45
    toe:  { x: 62, y: 20 }         // Toe area - moved 10% right and 5% down from 52,15
};

// --- Global Variables ---
const connectButton = document.getElementById('connectButton');
const statusDisplay = document.getElementById('status');
const canvas = document.getElementById('heatmap-canvas');
const ctx = canvas.getContext('2d');
let sensorData = { heel: 0, arch: 0, ball: 0, toe: 0 };
let simulationInterval = null;

// --- Simulation Mode Functions ---
function initSimulationControls() {
    // Individual sensor tests
    document.getElementById('testHeel').addEventListener('click', () => {
        sensorData = { heel: 1500, arch: 0, ball: 0, toe: 0 };
        drawHeatmap();
    });
    
    document.getElementById('testArch').addEventListener('click', () => {
        sensorData = { heel: 0, arch: 1200, ball: 0, toe: 0 };
        drawHeatmap();
    });
    
    document.getElementById('testBall').addEventListener('click', () => {
        sensorData = { heel: 0, arch: 0, ball: 1800, toe: 0 };
        drawHeatmap();
    });
    
    document.getElementById('testToe').addEventListener('click', () => {
        sensorData = { heel: 0, arch: 0, ball: 0, toe: 1000 };
        drawHeatmap();
    });
    
    // Scenario simulations
    document.getElementById('simulateWalking').addEventListener('click', simulateWalking);
    document.getElementById('simulateStanding').addEventListener('click', simulateStanding);
    document.getElementById('simulateRunning').addEventListener('click', simulateRunning);
    document.getElementById('clearHeatmap').addEventListener('click', clearHeatmap);
}

function simulateWalking() {
    clearInterval(simulationInterval);
    statusDisplay.textContent = 'Simulating Walking Pattern...';
    let step = 0;
    
    simulationInterval = setInterval(() => {
        step = (step + 1) % 8;
        
        switch(step) {
            case 0: sensorData = { heel: 1800, arch: 400, ball: 200, toe: 0 }; break;
            case 1: sensorData = { heel: 1600, arch: 800, ball: 600, toe: 200 }; break;
            case 2: sensorData = { heel: 1200, arch: 1200, ball: 1000, toe: 400 }; break;
            case 3: sensorData = { heel: 800, arch: 1000, ball: 1600, toe: 800 }; break;
            case 4: sensorData = { heel: 400, arch: 600, ball: 1800, toe: 1200 }; break;
            case 5: sensorData = { heel: 200, arch: 400, ball: 1400, toe: 1600 }; break;
            case 6: sensorData = { heel: 100, arch: 200, ball: 800, toe: 1800 }; break;
            case 7: sensorData = { heel: 0, arch: 100, ball: 400, toe: 1000 }; break;
        }
        drawHeatmap();
    }, 500);
}

function simulateStanding() {
    clearInterval(simulationInterval);
    statusDisplay.textContent = 'Simulating Standing Position...';
    sensorData = { heel: 1200, arch: 800, ball: 1000, toe: 600 };
    drawHeatmap();
}

function simulateRunning() {
    clearInterval(simulationInterval);
    statusDisplay.textContent = 'Simulating Running Pattern...';
    let step = 0;
    
    simulationInterval = setInterval(() => {
        step = (step + 1) % 6;
        
        switch(step) {
            case 0: sensorData = { heel: 2000, arch: 500, ball: 300, toe: 0 }; break;
            case 1: sensorData = { heel: 1800, arch: 1200, ball: 800, toe: 200 }; break;
            case 2: sensorData = { heel: 1000, arch: 1600, ball: 1800, toe: 1000 }; break;
            case 3: sensorData = { heel: 400, arch: 1200, ball: 2000, toe: 1800 }; break;
            case 4: sensorData = { heel: 0, arch: 600, ball: 1400, toe: 2000 }; break;
            case 5: sensorData = { heel: 0, arch: 200, ball: 600, toe: 1200 }; break;
        }
        drawHeatmap();
    }, 300);
}

function clearHeatmap() {
    clearInterval(simulationInterval);
    statusDisplay.textContent = 'Heatmap Cleared - Ready for Testing';
    sensorData = { heel: 0, arch: 0, ball: 0, toe: 0 };
    drawHeatmap();
}

// Initialize simulation controls when page loads
document.addEventListener('DOMContentLoaded', initSimulationControls);

// --- Web Bluetooth Connection ---
connectButton.addEventListener('click', async () => {
    try {
        statusDisplay.textContent = 'Searching for devices...';
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'SmartInsole_Pressure' }],
            optionalServices: [SERVICE_UUID]
        });

        statusDisplay.textContent = 'Connecting to device...';
        const server = await device.gatt.connect();

        statusDisplay.textContent = 'Getting Service...';
        const service = await server.getPrimaryService(SERVICE_UUID);

        statusDisplay.textContent = 'Getting Characteristics & Subscribing...';
        for (const [name, uuid] of Object.entries(CHARACTERISTIC_UUIDS)) {
            const characteristic = await service.getCharacteristic(uuid);
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', (event) => {
                handleNotification(name, event);
            });
        }
        
        statusDisplay.textContent = 'Connected and Listening! 🔥';
        connectButton.disabled = true;

    } catch (error) {
        console.error('Connection Failed:', error);
        statusDisplay.textContent = `Error: ${error.message}`;
    }
});

function handleNotification(name, event) {
    const value = event.target.value;
    let pressureValue = 0;
    
    // Try multiple parsing methods to ensure we get the data
    try {
        // First try as text
        const decoder = new TextDecoder('utf-8');
        const decodedValue = decoder.decode(value);
        pressureValue = parseInt(decodedValue, 10);
        
        // If that fails, try reading as raw bytes
        if (isNaN(pressureValue)) {
            const dataView = new DataView(value.buffer);
            pressureValue = dataView.getUint16(0, true); // little endian
        }
    } catch (error) {
        console.error(`Error parsing ${name} data:`, error);
        return;
    }
    
    sensorData[name] = pressureValue;
    
    // Debug output - you can see this in browser console (F12)
    console.log(`${name}: ${pressureValue}`);
    
    drawHeatmap();
}

// --- SMOOTH PRESSURE HEATMAP COLOR FUNCTION ---
// Red = no pressure, Blue = medium pressure, Green = high pressure
// With smooth transitions and better blending
function getPressureHeatmapColor(pressure) {
    // Clamp the value between 0 and 1
    const clampedValue = Math.max(0, Math.min(pressure, 1));
    
    if (clampedValue < 0.1) {
        // No/very low pressure = Red with smooth fade
        const alpha = Math.max(0.3, clampedValue * 3); // Minimum opacity for visibility
        return `rgba(255, 80, 80, ${alpha})`;
    } else if (clampedValue < 0.6) {
        // Medium pressure = Smooth transition from red to blue
        const factor = (clampedValue - 0.1) / 0.5; // 0 to 1 range
        const red = Math.floor(255 * (1 - factor) + 80 * factor);
        const green = Math.floor(80 * factor);
        const blue = Math.floor(80 * (1 - factor) + 255 * factor);
        const alpha = 0.6 + (factor * 0.2); // Gradually increase opacity
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    } else {
        // High pressure = Smooth transition from blue to green
        const factor = (clampedValue - 0.6) / 0.4; // 0 to 1 range
        const red = Math.floor(80 * (1 - factor));
        const green = Math.floor(80 * (1 - factor) + 200 * factor);
        const blue = Math.floor(255 * (1 - factor) + 80 * factor);
        const alpha = 0.8 + (factor * 0.15); // Maximum opacity for high pressure
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
}

// --- Smooth Heatmap Drawing Logic ---
function drawHeatmap() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Use 'multiply' for better color blending with the background
    ctx.globalCompositeOperation = 'multiply';

    for (const [name, data] of Object.entries(sensorData)) {
        // Normalize pressure value from 0-4095 to 0-1
        // Using a lower cap (2000) for better sensitivity
        const pressure = Math.min(data / 2000, 1.0);
        
        // Show ALL sensors, even with zero pressure (red)
        const pos = SENSOR_POSITIONS[name];
        const x = pos.x / 100 * canvas.width;
        const y = pos.y / 100 * canvas.height;
        
        // Create multiple gradient layers for smoother blending
        const baseRadius = 35;
        const maxRadius = baseRadius + (pressure * 80);
        
        // Outer gradient (very soft)
        const outerGradient = ctx.createRadialGradient(x, y, 0, x, y, maxRadius * 1.5);
        const outerColor = getPressureHeatmapColor(pressure * 0.3);
        outerGradient.addColorStop(0, outerColor);
        outerGradient.addColorStop(0.4, `rgba(240, 240, 240, 0.1)`);
        outerGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(x, y, maxRadius * 1.5, 0, 2 * Math.PI);
        ctx.fill();
        
        // Inner gradient (main color)
        const innerGradient = ctx.createRadialGradient(x, y, 0, x, y, maxRadius);
        const innerColor = getPressureHeatmapColor(pressure);
        innerGradient.addColorStop(0, innerColor);
        innerGradient.addColorStop(0.6, getPressureHeatmapColor(pressure * 0.7));
        innerGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.arc(x, y, maxRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Core gradient (brightest center)
        if (pressure > 0.1) {
            const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, maxRadius * 0.4);
            const coreColor = getPressureHeatmapColor(Math.min(pressure * 1.2, 1.0));
            coreGradient.addColorStop(0, coreColor);
            coreGradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = coreGradient;
            ctx.beginPath();
            ctx.arc(x, y, maxRadius * 0.4, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        // Add sensor labels for debugging (with better styling)
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.font = '11px Arial';
        ctx.fillText(`${name}: ${data}`, x - 25, y - maxRadius - 15);
        ctx.globalCompositeOperation = 'multiply';
    }
}
