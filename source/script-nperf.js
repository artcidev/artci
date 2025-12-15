/**
 * NPerfWidget
 * Encapsulates the nPerf iframe and a user sector/profile dialog.
 */
class NPerfWidget {
    constructor(options = {}) {
        this.target = options.target || document.body;
        this.url_path = "https://ws.nperf.com";
        this.iframeUrl = this.url_path + "/partner/frame?l=b488404b-14cb-4fdb-8ca7-7c59815934ef";

        // Initialize userSector from localStorage OR URL query params
        const urlParams = new URLSearchParams(window.location.search);
        const urlContext = urlParams.get('context') ? decodeURIComponent(urlParams.get('context')) : null;
        this.externalUuid = urlParams.get('uuid') || null;
        this.urlSector = urlContext;

        if (this.urlSector) {
            console.log("[NPerfWidget] Sector initialized from URL:", this.urlSector);
            this.userSector = this.urlSector;
        } else {
            this.userSector = localStorage.getItem('nperf_user_sector') || "";
        }

        // CSS matching ci-perf.html + new dropdown styles
        this.styles = `
            .nperf-modal {
                display: none;
                position: fixed;
                z-index: 9999;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
                justify-content: center;
                align-items: center;
                animation: nperfFadeIn 0.3s ease;
                font-family: 'Roboto', sans-serif;
            }
            .nperf-modal-content {
                background: white;
                padding: 32px;
                border-radius: 14px;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
                animation: nperfScaleIn 0.3s ease;
                text-align: center;
            }
            .nperf-modal-content h2 {
                margin-top: 0;
                color: #e3001b; /* nPerf Red or brand color */
                font-size: 1.5rem;
                margin-bottom: 8px;
                font-weight: 700;
            }
            .nperf-modal-content .subtitle {
                color: #6b7280;
                font-size: 0.95rem;
                margin-bottom: 24px;
            }
            .nperf-modal-content label {
                display: block;
                margin: 16px 0 8px;
                font-size: 0.95rem;
                font-weight: 600;
                color: #333;
                text-align: left;
            }
            
            /* Custom Dropdown Styles */
            .nperf-select-wrap {
                position: relative;
                text-align: left;
            }
            .nperf-select-trigger {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                background: #ffffff;
                color: #333;
                border: 1.5px solid #FB8521; /* Brand Orange */
                border-radius: 12px;
                padding: 12px 16px;
                cursor: pointer;
                font-size: 15px;
                transition: all 0.2s ease;
                box-sizing: border-box;
            }
            .nperf-select-trigger:hover {
                border-color: #E57212;
            }
            .nperf-select-label {
                font-weight: 700;
                color: #FB8521; /* Brand Orange text */
            }
            /* Chevron */
            .nperf-select-trigger::after {
                content: "";
                width: 12px;
                height: 12px;
                border-right: 2px solid #FB8521;
                border-bottom: 2px solid #FB8521;
                transform: rotate(45deg);
                transition: transform 0.2s ease;
                margin-right: 4px;
                
            }
            .nperf-select-trigger[aria-expanded="true"]::after {
                transform: rotate(-135deg);
                margin-top: 4px;
            }

            .nperf-select-list {
                display: none;
                position: absolute;
                left: 0;
                right: 0;
                top: calc(100% + 6px);
                background: #ffffff;
                color: #333;
                border: 1.5px solid #FB8521;
                border-radius: 12px;
                box-shadow: 0 8px 22px rgba(0, 0, 0, .28);
                list-style: none;
                margin: 0;
                padding: 10px;
                z-index: 10000;
                max-height: 300px;
                overflow-y: auto;
            }
            .nperf-select-list.open {
                display: block;
            }

            .nperf-select-option {
                display: grid;
                grid-template-columns: 20px 1fr;
                align-items: center;
                column-gap: 10px;
                padding: 10px 8px;
                border-radius: 8px;
                cursor: pointer;
                user-select: none;
            }
            .nperf-select-option:hover {
                background: rgba(251, 133, 33, .08);
            }
            
            .nperf-opt-bullet {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                border: 2px solid #FB8521;
                background: transparent;
                display: inline-block;
                transition: background 0.2s;
            }
            .nperf-select-option.selected .nperf-opt-bullet {
                background: #FB8521;
            }
            .nperf-opt-text {
                color: #FB8521;
                font-weight: 600;
                font-size: 0.95rem;
            }

            .nperf-other-input-wrap {
                margin-top: 16px;
                display: none;
                text-align: left;
                animation: nperfFadeIn 0.3s ease;
            }
            .nperf-other-input-wrap.visible {
                display: block;
            }
            .nperf-other-input {
                width: 100%;
                padding: 12px 16px;
                border: 1.5px solid #FB8521;
                border-radius: 12px;
                font-size: 15px;
                box-sizing: border-box;
                font-family: inherit;
            }
            .nperf-other-input:focus {
                outline: none;
                box-shadow: 0 0 0 3px rgba(251, 133, 33, 0.2);
            }

            .nperf-btn-submit {
                margin-top: 24px;
                width: 100%;
                padding: 14px;
                background: #FB8521; /* Brand Orange */
                color: white;
                border: none;
                border-radius: 12px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 700;
                transition: background 0.2s ease;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .nperf-btn-submit:hover {
                background: #E57212;
            }
            
            @keyframes nperfFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes nperfScaleIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
        `;

        this.init();
    }

    init() {
        this.injectStyles();
        this.createModal();
        this.renderIframe();
        this.bindEvents();
        // Do NOT show modal on init anymore
    }

    injectStyles() {
        if (!document.getElementById('nperf-widget-styles')) {
            const styleSheet = document.createElement("style");
            styleSheet.id = 'nperf-widget-styles';
            styleSheet.innerText = this.styles;
            document.head.appendChild(styleSheet);
        }
    }

    createModal() {
        // Create modal container
        this.modal = document.createElement('div');
        this.modal.className = 'nperf-modal';
        this.modal.id = 'nPerfUserModal';

        // Options
        const options = [
            "Consommateur / Société civile",
            "Administration / Service public",
            "Régions / Collectivités",
            "Entreprise / Secteur privé",
            "Secteur Santé",
            "Secteur Education",
            "Presse / Médias",
            "Artci",
            "Autres"
        ];

        let optionsHtml = options.map(opt => `
            <li class="nperf-select-option" data-value="${opt}">
                <span class="nperf-opt-bullet"></span>
                <span class="nperf-opt-text">${opt}</span>
            </li>
        `).join('');

        // Content
        this.modal.innerHTML = `
            <div class="nperf-modal-content">
                <img src="https://nperf.com/favicon.ico" style="width: 48px; margin-bottom: 16px; display:none;"> 
                <!-- Header Icon could be added here if needed like in design -->
                
                <h2 style="color: #000; font-size: 1.25rem;">Quel est votre Secteur / Profil ?</h2>
                <p class="subtitle">Pour nous aider à mieux analyser vos besoins et vos retours, veuillez indiquer le secteur/profil qui vous correspond.</p>
                
                <div class="nperf-select-wrap">
                    <button type="button" class="nperf-select-trigger" aria-expanded="false">
                        <span class="nperf-select-label">Secteur / Profil</span>
                    </button>
                    <ul class="nperf-select-list">
                        ${optionsHtml}
                    </ul>
                </div>

                <div class="nperf-other-input-wrap">
                    <label for="nperf-other-detail" style="margin-top:0;">Commentaire</label>
                    <input type="text" id="nperf-other-detail" class="nperf-other-input" placeholder="Ex: Consommateur, Entreprise...">
                </div>
                
                <button class="nperf-btn-submit">CONTINUER</button> 
            </div>
        `;

        document.body.appendChild(this.modal);

        // Bind DOM elements
        this.triggerBtn = this.modal.querySelector('.nperf-select-trigger');
        this.dropdownList = this.modal.querySelector('.nperf-select-list');
        this.submitBtn = this.modal.querySelector('.nperf-btn-submit');
        this.labelSpan = this.modal.querySelector('.nperf-select-label');
        this.optionsEls = this.modal.querySelectorAll('.nperf-select-option');
        this.otherInputWrap = this.modal.querySelector('.nperf-other-input-wrap');
        this.otherInput = this.modal.querySelector('#nperf-other-detail');

        // Bind interactions
        this.triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        this.optionsEls.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectOption(opt);
            });
        });

        this.submitBtn.addEventListener('click', () => this.handleSubmit());

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!this.triggerBtn.contains(e.target) && !this.dropdownList.contains(e.target)) {
                this.closeDropdown();
            }
        });
    }

    toggleDropdown() {
        const isOpen = this.dropdownList.classList.contains('open');
        if (isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        this.dropdownList.classList.add('open');
        this.triggerBtn.setAttribute('aria-expanded', 'true');
    }

    closeDropdown() {
        this.dropdownList.classList.remove('open');
        this.triggerBtn.setAttribute('aria-expanded', 'false');
    }

    selectOption(optionEl) {
        // Deselect all
        this.optionsEls.forEach(el => el.classList.remove('selected'));
        // Select one
        optionEl.classList.add('selected');

        const value = optionEl.getAttribute('data-value');
        this.tempUserSector = value; // Store temporarily

        // Update label
        this.labelSpan.textContent = value;

        // Show/Hide Other Input
        if (value === "Autres") {
            this.otherInputWrap.classList.add('visible');
            setTimeout(() => this.otherInput.focus(), 100);
        } else {
            this.otherInputWrap.classList.remove('visible');
        }

        this.closeDropdown();
    }

    showModal() {
        this.modal.style.display = 'flex';
    }

    hideModal() {
        this.modal.style.display = 'none';
    }

    handleSubmit() {
        if (!this.tempUserSector) {
            alert("Veuillez sélectionner un secteur.");
            return;
        }

        let finalSector = this.tempUserSector;

        // Use "Other" detail if applicable
        if (this.tempUserSector === "Autres") {
            const detail = this.otherInput.value.trim();
            if (!detail) {
                alert("Veuillez préciser votre secteur.");
                this.otherInput.focus();
                return;
            }
            finalSector = "Autres: " + detail;
        }

        // Persist choice logic:
        // If "Autres", do NOT save (remove existing) so it asks again next time.
        // Otherwise, save to skip dialog in future.
        this.userSector = finalSector;

        if (this.userSector.startsWith("Autres")) {
            localStorage.removeItem('nperf_user_sector');
        } else {
            localStorage.setItem('nperf_user_sector', this.userSector);
        }

        console.log("Secteur choisi:", this.userSector);
        this.hideModal();

        // Process the pending result if available
        if (this.pendingResultData) {
            this.processResult(this.pendingResultData);
            this.pendingResultData = null; // Clear
        }
    }

    renderIframe() {
        let container = typeof this.target === 'string' ? document.querySelector(this.target) : this.target;
        if (!container) {
            console.error("NPerfWidget: Target container not found. Appending to body.");
            container = document.body;
        }

        const iframe = document.createElement('iframe');
        iframe.id = "nPerfSpeedTest";
        iframe.src = this.iframeUrl;
        iframe.width = "0";
        iframe.height = "0";
        iframe.frameBorder = "0";
        iframe.scrolling = "no";
        iframe.style.cssText = "overflow: hidden; display: block; margin: 0px; padding: 0px; max-width: 600px; height: 500px; width: 100%";
        iframe.allow = "geolocation";
        iframe.referrerPolicy = "unsafe-url";

        container.appendChild(iframe);
        this.iframe = iframe;

        if (iframe.offsetWidth > 0 && iframe.offsetWidth < 600) {
            iframe.style.height = "500px";
        }
    }

    bindEvents() {
        window.addEventListener("message", (event) => {
            const allowedOrigins = [
                "https://ws.nperf.com",
                "https://ws-cdn.nperf.com",
                "http://ws-nossl.nperf.com"
            ];

            if (!allowedOrigins.includes(event.origin)) return;

            const data = event.data;
            if (!data || !data.action) return;

            console.log("[NPerfWidget] Received action", data.action);

            // Route events
            switch (data.action) {
                case "nPerfLoaded": this.onLoaded(); break;
                case "nPerfReady": this.onReady(); break;
                case "nPerfError": this.onError(data.type); break;
                case "nPerfTestStarted": this.onTestStarted(); break;
                case "nPerfTestCompleted": this.onTestCompleted(data); break;
                case "nPerfGetLastResult": this.onGetLastResult(data.lastResult); break;
                case "nPerfResponsiveSwitch": this.onResponsiveSwitch(data); break;
            }
        });
    }

    // --- Event Handlers Stub ---

    onLoaded() { console.log("[NPerfWidget] Loaded"); }
    onReady() { console.log("[NPerfWidget] Ready"); }
    onError(type) { console.warn("[NPerfWidget] Error:", type); }
    onTestStarted() { console.log("[NPerfWidget] Started"); }

    onTestCompleted(data) {
        console.log("[NPerfWidget] Test Completed (Raw)", data);

        if (this.userSector) {
            // User already has a sector, process immediately
            this.processResult(data);
        } else {
            // No sector, hold result and ask user
            this.pendingResultData = data;
            this.showModal();
        }
    }

    processResult(data) {
        console.log("Processing Result with Sector:", this.userSector);
        data.userSector = this.userSector;

        // Prepare API Payload
        const payload = {
            nperf_test_id: data.resultId || data.id || (data.result ? data.result.id : null) || "".toString(),
            external_uuid: data.device.uuid,
            sector: this.userSector
        };

        // Attempt to find ID in varying nPerf structures if top-level helper failed
        if ((!payload.nperf_test_id) && data.result && data.result.id) {
            payload.nperf_test_id = data.result.id;
        }

        console.log("Sending API Payload:", payload);

        // Send to Backend
        fetch('https://app.artci.ci/api/nperf/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => {
            if (res.ok) console.log("Result saved to backend.");
            else console.warn("Failed to save result to backend.");
        }).catch(err => console.error("Error saving result:", err));
    }

    onGetLastResult(lastResult) {
        console.log("[NPerfWidget] Last Result", lastResult);

        this.onTestCompleted(lastResult);
    }

    onResponsiveSwitch(data) {
        if (!this.iframe) return;
        if (data.mode == "smart") this.iframe.style.height = "500px";
        else this.iframe.style.height = "400px";
    }
}

window.NPerfWidget = NPerfWidget;