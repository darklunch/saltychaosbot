// ==UserScript==
// @name         SaltyChaosBot
// @namespace    http://darklun.ch/
// @version      1.0
// @description  Automated betting bot for SaltyBet that blends cryptographically secure coinflips with a touch of absurdist chaos and dynamic art.
// @author       unsoundlogic (Dark Lunch Studios)
// @match        https://www.saltybet.com/
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// ==/UserScript==

// Add styles for the floating UI
GM_addStyle(`
    #bot-ui {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 15px;
        border-radius: 5px;
        z-index: 9999;
        min-width: 200px;
        font-family: Arial, sans-serif;
        cursor: move;
        user-select: none;
    }
    #bot-ui h3 {
        margin: 0 0 10px 0;
        background: linear-gradient(45deg, #ffd700, #ff6b6b);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: gradientShift 10s ease infinite;
    }
    @keyframes gradientShift {
        0% { filter: hue-rotate(0deg); }
        50% { filter: hue-rotate(180deg); }
        100% { filter: hue-rotate(360deg); }
    }
    .bot-stat {
        margin: 5px 0;
    }
    .status-message {
        margin-top: 10px;
    }
    .status-message.red {
        color: #B04444;
    }
    .status-message.blue {
        color: #349EFF;
    }
    .last-bet {
        color: #ff9900;
    }
    .refresh-controls {
        margin-top: 10px;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    .controls-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
    }
    #reset-stats {
        background: #ff4444;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        flex: 0 0 auto;
    }
    #reset-stats:hover {
        background: #ff6666;
    }
    #refresh-interval {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid #666;
        padding: 2px 5px;
        border-radius: 3px;
    }
    .gcp-container {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
    }
    .gcp-container iframe {
        border: none;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 3px;
    }
    .lucky-text {
        background: linear-gradient(
            90deg,
            hsl(var(--luck-hue), 100%, 65%),
            hsl(calc(var(--luck-hue) + 180), 100%, 65%)
        );
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        background-size: 200% 100%;
        animation: luckFlow 4s linear infinite;
    }
    @keyframes luckFlow {
        0% {
            background-position: 0% 50%;
        }
        100% {
            background-position: 200% 50%;
        }
    }
`);

class SaltyBetBot {
    constructor() {
        this.isProcessingBet = false;
        this.lastBetTeam = null;
        this.stats = {
            totalBets: GM_getValue('totalBets', 0),
            correctBets: GM_getValue('correctBets', 0)
        };
        this.refreshEnabled = GM_getValue('refreshEnabled', false);
        this.refreshInterval = GM_getValue('refreshInterval', 30); // default 30 minutes

        this.lastStatusChange = Date.now();
        this.canRefresh = false;

        this.currentMatchData = null;
        this.initializeTwitchChat();

        this.position = {
            x: GM_getValue('uiPositionX', 20),
            y: GM_getValue('uiPositionY', 20)
        };

        this.setupUI();
        this.initializeObservers();
        this.startPolling();
        this.setupRefreshTimer();
    }

    async setupUI() {
        const ui = document.createElement('div');
        ui.id = 'bot-ui';

        ui.style.right = 'auto';
        ui.style.left = `${this.position.x}px`;
        ui.style.top = `${this.position.y}px`;

        // Generate initial colors for the gradient
        const initialHue = Math.floor((await this.getRandomBetAmount()) % 360);

        GM_addStyle(`
            @property --gradient-hue {
                syntax: '<number>';
                initial-value: ${initialHue};
                inherits: false;
            }

            #bot-ui h3 {
                margin: 0 0 10px 0;
                font-size: 1.2em;
                font-weight: bold;
                background: linear-gradient(
                    90deg,
                    hsl(var(--gradient-hue), 100%, 65%),
                    hsl(calc(var(--gradient-hue) + 120), 100%, 65%),
                    hsl(calc(var(--gradient-hue) + 240), 100%, 65%),
                    hsl(var(--gradient-hue), 100%, 65%)
                );
                -webkit-background-clip: text;
                background-clip: text;
                color: transparent;
                background-size: 300% 100%;
                display: inline-block;
                animation: gradientFlow 6s linear infinite;
            }

            @keyframes gradientFlow {
                0% {
                    background-position: 0% 50%;
                }
                100% {
                    background-position: 300% 50%;
                }
            }
        `);

        ui.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0;">🧂 SaltyChaosBot 🌀</h3>
                <div class="gcp-container" style="margin-left: 8px;">
                    <iframe src="https://global-mind.org/gcpdot/gcp.html" height="20" width="20" scrolling="no"></iframe>
                </div>
            </div>
            <div class="bot-stat" style="margin: 8px 0; line-height: 1.4;">Luck: <span id="luck-percentage">${this.calculateLuck()}%</span></div>
            <div class="bot-stat" style="margin: 8px 0; line-height: 1.4;">Total Bets: <span id="total-bets">${this.stats.totalBets}</span></div>
            <div class="bot-stat" style="margin: 8px 0; line-height: 1.4;">Chaos Clicks: <span id="chaos-clicks">${GM_getValue('chaosClicks', 0)}</span></div>
            <div class="last-bet" style="margin: 8px 0; line-height: 1.4;">Last Bet: <span id="last-bet">None</span></div>
            <div class="status-message" id="status-message" style="margin: 12px 0; line-height: 1.4;">Initializing...</div>
            <div class="refresh-controls" style="margin: 12px 0; display: flex; align-items: center; gap: 8px;">
                <label>
                    <input type="checkbox" id="refresh-toggle" ${this.refreshEnabled ? 'checked' : ''}>
                    Auto Refresh
                </label>
                <input type="number" id="refresh-interval" value="${this.refreshInterval}" min="1" style="width: 50px; text-align: center;">
                <span>minutes</span>
            </div>
            <div class="controls-row" style="display: flex; justify-content: space-between; align-items: center; margin: 12px 0 0 0;">
                <button id="chaos-button" style="width: 120px; margin-right: 8px; background: rgba(255, 68, 68, 0.2); border: 1px solid #ff4444; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s ease;">Introduce Chaos</button>
                <button id="reset-stats" style="width: 120px; background: rgba(255, 68, 68, 0.2); color: #ff4444; border: 1px solid #ff4444; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s ease;">Reset</button>
            </div>
        `;
        document.body.appendChild(ui);

        // Update colors smoothly using CSS custom properties
        let currentHue = initialHue;
        setInterval(async () => {
            const chaosValue = await this.getRandomBetAmount();
            // Smooth transition to new hue
            currentHue = (currentHue + (chaosValue % 30) - 15 + 360) % 360; // Small random adjustment

            const titleElement = document.querySelector('#bot-ui h3');
            if (titleElement) {
                titleElement.style.setProperty('--gradient-hue', currentHue);
            }
        }, 100); // Update every 100ms for smooth transitions

        // Existing event listeners remain the same
        document.getElementById('reset-stats').addEventListener('click', () => this.resetStats());
        document.getElementById('refresh-toggle').addEventListener('change', (e) => {
            this.refreshEnabled = e.target.checked;
            GM_setValue('refreshEnabled', this.refreshEnabled);
            this.setupRefreshTimer();
        });
        document.getElementById('refresh-interval').addEventListener('change', (e) => {
            this.refreshInterval = parseInt(e.target.value);
            GM_setValue('refreshInterval', this.refreshInterval);
            this.setupRefreshTimer();
        });

        // Add drag functionality
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        ui.addEventListener('mousedown', (e) => {
            isDragging = true;
            initialX = e.clientX - this.position.x;
            initialY = e.clientY - this.position.y;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                // Constrain to window bounds
                currentX = Math.max(0, Math.min(window.innerWidth - ui.offsetWidth, currentX));
                currentY = Math.max(0, Math.min(window.innerHeight - ui.offsetHeight, currentY));

                this.position.x = currentX;
                this.position.y = currentY;

                ui.style.left = `${currentX}px`;
                ui.style.top = `${currentY}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                // Save position
                GM_setValue('uiPositionX', this.position.x);
                GM_setValue('uiPositionY', this.position.y);
            }
        });

        // Update chaos button gradient style
        GM_addStyle(`
            @property --chaos-hue {
                syntax: '<number>';
                initial-value: ${Math.floor(Math.random() * 360)};
                inherits: false;
            }

            #chaos-button {
                position: relative;
                background: linear-gradient(
                    90deg,
                    hsl(var(--chaos-hue), 70%, 45%),
                    hsl(calc(var(--chaos-hue) + 120), 70%, 45%),
                    hsl(calc(var(--chaos-hue) + 240), 70%, 45%),
                    hsl(var(--chaos-hue), 70%, 45%)
                ) !important;
                border: none !important;
                color: white !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                font-weight: bold;
                background-size: 300% 100%;
                animation: chaosFlow 3s linear infinite;
                transition: all 0.3s ease;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }

            #chaos-button:hover {
                transform: scale(1.05);
                filter: brightness(1.2);
            }

            @keyframes chaosFlow {
                0% { background-position: 0% 50%; }
                100% { background-position: 300% 50%; }
            }
        `);

        // Update chaos button animation
        const chaosButton = document.getElementById('chaos-button');
        let currentChaosHue = Math.floor(Math.random() * 360);

        setInterval(() => {
            currentChaosHue = (currentChaosHue + 2) % 360;
            chaosButton.style.setProperty('--chaos-hue', currentChaosHue);
        }, 50);

        chaosButton.addEventListener('click', () => {
            const currentClicks = GM_getValue('chaosClicks', 0);
            GM_setValue('chaosClicks', currentClicks + 1);
            document.getElementById('chaos-clicks').textContent = currentClicks + 1;
            this.chaosValue = (this.chaosValue || 0) + Math.random();
        });
    }

    calculateLuck() {
        if (this.stats.totalBets === 0) return "0.00";
        return ((this.stats.correctBets / this.stats.totalBets) * 100).toFixed(2);
    }

    async secureCoinFlip() {
        return await this.butterflyEffectFlip();
    }

    async butterflyEffectFlip() {
        let chaos = 0; // Declare chaos variable outside try block
        try {
            // Add ANU Quantum RNG fetch
            const quantumResponse = await fetch('https://qrng.anu.edu.au/API/jsonI.php?length=1&type=uint8');
            const quantumData = await quantumResponse.json();
            const quantumBit = quantumData.data[0] % 2;  // True quantum randomness!

            // Existing chaos factors collection
            const chaosFactors = [
                performance.now(),
                window.innerWidth * window.innerHeight,
                window.screenX + window.screenY,
                new Date().getTimezoneOffset(),
                navigator.hardwareConcurrency,
                document.documentElement.scrollTop,
                window.devicePixelRatio,
                navigator.deviceMemory || 0,
                window.performance.memory?.usedJSHeapSize || 0,
                new Date().getMilliseconds(),
                navigator.getBattery ? (await navigator.getBattery()).level : 0,
                navigator.connection?.rtt || 0,
                document.getElementsByTagName('*').length,
                window.history.length,
                document.title.length,
                navigator.userAgent.length,
                window.localStorage.length,
                document.cookie.length,
                window.performance.timeOrigin,
                (document.querySelector('#lastbet')?.textContent || '').length,
                Math.sin(Date.now() / 1000) * Math.PI,
                navigator.language.charCodeAt(0),
                window.crypto.getRandomValues(new Uint8Array(1))[0] / 255,
                document.visibilityState === 'visible' ? 1 : 0,
                new Error().stack?.length || 0,
                performance.now() % navigator.hardwareConcurrency,
                // Add chaos clicks as an additional factor
                (GM_getValue('chaosClicks', 0) * Math.PI) % 1,
                // Add accumulated chaos value
                (this.chaosValue || 0) * Math.E,
                // Add quantum factor
                quantumBit,
                // Add bias prevention factors
                (Date.now() / 7919) % 1,  // Using Mersenne prime for division
                Math.sqrt(12345 + performance.now()) % 1,
                // Use golden ratio conjugate for additional irrationality
                (Math.sqrt(5) - 1) / 2 * (performance.now() % 1000),
                // Add Thue-Morse sequence element for bias prevention
                this.thueMorseElement(Math.floor(performance.now() % 256))
            ];

            // Initialize chaos with factors
            chaos = chaosFactors.reduce((acc, val) => acc + val, 0);

            // Keep all the beautiful irrational numbers
            const ratios = [
                1.618033988749895,  // Golden ratio (φ)
                2.414213562373095,  // Silver ratio
                3.302775637731995,  // Bronze ratio
                Math.PI,            // π
                Math.E,             // e
                Math.SQRT2,         // √2
                2.685452001065306,  // Khinchin's constant
                4.669201609102990   // Feigenbaum constant
            ];

            // Create chaos through multiple iterations of mathematical constants
            for(let i = 0; i < 42; i++) {  // The answer to life, the universe, and everything
                const ratio = ratios[i % ratios.length];
                chaos = Math.sin(chaos * ratio) * Math.cos(chaos / ratio) * 10000;

                // Add some trigonometric chaos
                chaos += Math.tan(chaos / Math.PI) * Math.sin(chaos * Math.E);

                // Sprinkle in some logarithmic chaos
                chaos *= Math.log(Math.abs(chaos) + Math.E);

                // Quantum-inspired phase shift
                if (i % 2 === 0) {
                    chaos = Math.atan(chaos) * Math.sqrt(Math.abs(chaos));
                }

                // Add a tiny bit of true randomness each iteration to prevent any potential patterns
                chaos ^= crypto.getRandomValues(new Uint8Array(1))[0];
            }

            // Final chaos transformation using the Fibonacci sequence
            const fib = (n) => n <= 1 ? n : fib(n-1) + fib(n-2);
            chaos *= fib(7) / fib(6);  // Use golden ratio approximation

            // XOR with one final random byte to ensure uniform distribution
            // while maintaining the chaotic nature of the decision
            chaos ^= crypto.getRandomValues(new Uint8Array(1))[0];

            // Final decision combines quantum randomness with chaos
            // XOR the final result with the quantum bit for true quantum influence
            return (Math.abs(chaos) % 2 === 1) ^ quantumBit === 1;
        } catch (error) {
            console.warn('Quantum RNG unavailable, falling back to chaos-only decision');
            return Math.abs(chaos) % 2 === 1;
        }
    }

    // Add this helper method for Thue-Morse sequence
    thueMorseElement(n) {
        let count = 0;
        while (n > 0) {
            count += n & 1;
            n >>= 1;
        }
        return count % 2;
    }

    async getRandomBetAmount() {
        // Get current balance
        const balanceElement = document.getElementById('balance');
        if (!balanceElement) throw new Error('Balance element not found');

        const balance = parseInt(balanceElement.textContent.replace(/,/g, ''));
        // Use 100% cap for tournament matches, 10% otherwise
        const maxBet = Math.floor(balance * (this.currentMatchData?.isTournament ? 1.0 : 0.1));

        // Generate random number between 1 and maxBet
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return Math.max(1, Math.floor((array[0] / 0xFFFFFFFF) * maxBet));
    }

    updateUI(statusMessage, lastBet = null) {
        const statusElement = document.getElementById('status-message');
        statusElement.textContent = statusMessage;

        // Remove existing color classes
        statusElement.classList.remove('red', 'blue');

        // Add color class based on bet team if status includes "Placed"
        if (statusMessage.includes('Placed') && this.lastBetTeam) {
            statusElement.classList.add(this.lastBetTeam.toLowerCase());
        }

        document.getElementById('total-bets').textContent = this.stats.totalBets;
        const luckPercentage = this.calculateLuck();
        const luckElement = document.getElementById('luck-percentage');
        luckElement.textContent = luckPercentage + '%';

        // Add or remove lucky-text class based on luck percentage
        if (parseFloat(luckPercentage) > 50) {
            luckElement.classList.add('lucky-text');
            // Set a random hue for the gradient that's different from the title
            const randomHue = Math.floor(Math.random() * 360);
            luckElement.style.setProperty('--luck-hue', randomHue);
        } else {
            luckElement.classList.remove('lucky-text');
        }

        if (lastBet) {
            document.getElementById('last-bet').textContent = lastBet;
        }
    }

    async placeBet() {
        if (this.isProcessingBet) return;

        // Don't place bet until we have match data
        if (!this.currentMatchData) {
            this.updateUI('Waiting for match data...');
            return;
        }

        try {
            this.isProcessingBet = true;
            const betOnRed = await this.secureCoinFlip();

            // Get random bet amount
            const betAmount = await this.getRandomBetAmount();

            // Set wager amount
            const wagerInput = document.getElementById('wager');
            if (!wagerInput) throw new Error('Wager input not found');
            wagerInput.value = betAmount;

            // Click the appropriate team button
            const buttonId = betOnRed ? 'player1' : 'player2';
            const betButton = document.getElementById(buttonId);
            if (!betButton) throw new Error('Bet button not found');

            betButton.click();
            this.lastBetTeam = betOnRed ? 'RED' : 'BLUE';
            const betMsg = `${betAmount} on ${this.lastBetTeam}`;
            this.updateUI(`Placed ${betMsg}`, betMsg);

            this.stats.totalBets++;
            GM_setValue('totalBets', this.stats.totalBets);

        } catch (error) {
            console.error('Error placing bet:', error);
            this.updateUI(`Error: ${error.message}`);
        }
    }

    initializeObservers() {
        // Monitor bet status changes
        const betStatus = document.getElementById('betstatus');
        if (betStatus) {
            new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        this.handleStatusChange(betStatus.textContent);
                    }
                }
            }).observe(betStatus, { childList: true, subtree: true });
        }
    }

    handleStatusChange(status) {
        this.lastStatusChange = Date.now();

        if (status.includes('Bets are OPEN')) {
            this.canRefresh = false;
            // Only place bet if we're not already processing one
            if (!this.isProcessingBet) {
                this.placeBet();
            }
        } else if (status.includes('Bets are LOCKED')) {
            // Allow refresh 5 seconds after bets are locked
            setTimeout(() => {
                this.canRefresh = true;
            }, 5000);
        } else if (status.includes('wins')) {
            this.processOutcome(status);
        }
    }

    processOutcome(status) {
        if (!this.lastBetTeam) return;

        let correctBet;
        if (typeof status === 'string') {
            // More explicit win detection from status message
            const statusLower = status.toLowerCase();
            const redWon = statusLower.includes('red wins') || statusLower.includes('team red wins');
            const blueWon = statusLower.includes('blue wins') || statusLower.includes('team blue wins');

            if (!redWon && !blueWon) return; // Don't process if we can't determine winner

            correctBet = (redWon && this.lastBetTeam === 'RED') ||
                        (blueWon && this.lastBetTeam === 'BLUE');
        } else {
            // Handle boolean from Twitch chat
            correctBet = status;
        }

        // Only process if we haven't already processed this outcome
        if (this.isProcessingBet) {
            this.stats.correctBets += correctBet ? 1 : 0;
            GM_setValue('correctBets', this.stats.correctBets);
            this.updateUI(correctBet ? 'Fate Flips—Luck Wins 🍀' : 'Fate Flips—Luck Fails 😞');

            this.isProcessingBet = false;
            this.lastBetTeam = null;
        }
    }

    startPolling() {
        setInterval(() => {
            const betStatus = document.getElementById('betstatus');
            if (betStatus) {
                this.handleStatusChange(betStatus.textContent);
            }
        }, 2000);
    }

    resetStats() {
        this.stats.totalBets = 0;
        this.stats.correctBets = 0;
        GM_setValue('totalBets', 0);
        GM_setValue('correctBets', 0);
        GM_setValue('chaosClicks', 0);
        document.getElementById('chaos-clicks').textContent = '0';

        this.position = { x: 20, y: 20 };
        GM_setValue('uiPositionX', this.position.x);
        GM_setValue('uiPositionY', this.position.y);

        const ui = document.getElementById('bot-ui');
        if (ui) {
            ui.style.left = `${this.position.x}px`;
            ui.style.top = `${this.position.y}px`;
        }

        this.updateUI('Stats and position reset!');
    }

    setupRefreshTimer() {
        // Clear existing timer if any
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        // Set up new timer if enabled
        if (this.refreshEnabled) {
            this.refreshTimer = setInterval(() => {
                // Only refresh if we're in a safe state and enough time has passed
                if (this.canRefresh &&
                    Date.now() - this.lastStatusChange > 5000 &&
                    !this.isProcessingBet) {
                    window.location.reload();
                }
            }, this.refreshInterval * 60 * 1000);
        }
    }

    // Add new method for Twitch chat integration
    initializeTwitchChat() {
        const script = document.createElement('script');
        script.src = "https://darklun.ch/hosted/tmi.min.js";
        script.onload = () => {
            const client = new tmi.Client({
                options: { debug: false },
                connection: {
                    reconnect: true,
                    secure: true
                },
                channels: ["#saltybet"]
            });

            client.connect().catch(err => console.error("TwitchChat Connection error:", err));
            client.on('message', (channel, userstate, message, self) => {
                if (self) return;
                const username = userstate['display-name'] || userstate.username;
                if (username.toLowerCase() === "waifu4u") {
                    this.processWaifuMessage(message);
                }
            });
        };
        document.head.appendChild(script);
    }

    // Add new method to process Waifu messages
    processWaifuMessage(message) {
        if (message.includes("Bets are OPEN for")) {
            const matchRegex = /Bets are OPEN for (.+?) vs (.+?)!/;
            const matches = message.match(matchRegex);
            if (matches) {
                this.currentMatchData = {
                    redFighter: matches[1],
                    blueFighter: matches[2],
                    winner: null,
                    isTournament: message.includes("tournament bracket")
                };
                // Now that we have match data, try to place the bet
                this.placeBet();
            }
        }
        else if (message.includes("wins! Payouts to Team")) {
            // More reliable winner detection from Waifu messages
            const winner = message.includes("Team Red") ? "RED" : "BLUE";
            if (this.lastBetTeam && this.isProcessingBet) {
                const correctBet = winner === this.lastBetTeam;
                this.processOutcome(correctBet);
            }
        }
    }
}

// Initialize the bot when the page is ready
(function() {
    'use strict';
    window.addEventListener('load', () => {
        new SaltyBetBot();
    });
})();
