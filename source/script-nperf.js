/**
 * NPerfWidget
 * Encapsulates the nPerf iframe and a user sector/profile dialog.
 * Version 1.0.0
 * Author: Beye Daouda
 * Date: 2025-12-16
 */
class NPerfWidget {
    constructor(options = {}) {
        this.target = options.target || document.body;
        // Auto-detect environment
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        //const defaultApi = isLocal ? 'http://localhost:8000' : 'https://app.artci.ci';
        const defaultApi = 'https://app.artci.ci';
        this.apiBaseUrl = options.apiUrl || defaultApi;

        this.url_path = "https://ws.nperf.com";
        this.iframeUrl = this.url_path + "/partner/frame?l=b488404b-14cb-4fdb-8ca7-7c59815934ef";

        // Initialize userSector from localStorage OR URL query params
        const urlParams = new URLSearchParams(window.location.search);
        const urlContext = urlParams.get('context') ? decodeURIComponent(urlParams.get('context')) : null;
        this.externalUuid = urlParams.get('uuid') || null;
        this.urlSector = urlContext;

        if (this.urlSector) {
            // console.log("[NPerfWidget] Sector initialized from URL:", this.urlSector);
            this.userSector = this.urlSector;
        } else {
            this.userSector = localStorage.getItem('nperf_user_sector') || "";
        }

        // CSS matching ci-perf.html + new dropdown styles
        this.styles = `
            /* Reset & Base */
            .nperf-widget-reset, .nperf-widget-reset * {
                box-sizing: border-box !important;
                font-family: 'Roboto', sans-serif !important;
                line-height: normal !important;
            }

            .nperf-modal {
                display: none;
                position: fixed;
                z-index: 2147483647; /* Max z-index */
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
                justify-content: center;
                align-items: center;
                animation: nperfFadeIn 0.3s ease;
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
                position: relative;
            }
            .nperf-modal-content h2 {
                margin-top: 20px;
                color: #e3001b;
                font-size: 1.5rem !important;
                margin-bottom: 8px;
                font-weight: 700;
                line-height: 1.3 !important;
            }
            .nperf-modal-content .subtitle {
                color: #6b7280;
                font-size: 0.95rem !important;
                margin-bottom: 24px;
                margin-top: 0;
                line-height: 1.5 !important;
            }
            
            /* Close Button */
            .nperf-close-btn {
                position: absolute;
                top: 12px;
                right: 12px;
                background: #f3f4f6;
                border: none;
                border-radius: 50%;
                width: 32px !important;
                height: 32px !important;
                cursor: pointer;
                display: flex !important;
                align-items: center;
                justify-content: center;
                color: #4b5563 !important;
                transition: all 0.2s;
                padding: 0 !important;
                z-index: 10;
            }
            .nperf-close-btn:hover {
                background: #e5e7eb;
                color: #111827 !important;
            }
            .nperf-close-btn svg {
                width: 20px !important;
                height: 20px !important;
                fill: #4b5563 !important; /* Force fill */
                display: block !important;
                min-width: 20px;
            }
            .nperf-close-btn:hover svg {
                fill: #111827 !important;
            }

            .nperf-modal-content label {
                display: block;
                margin: 16px 0 8px;
                font-size: 0.95rem !important;
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
                border: 1.5px solid #FB8521;
                border-radius: 12px;
                padding: 0 16px !important; /* Fixed padding */
                cursor: pointer;
                font-size: 15px !important;
                transition: all 0.2s ease;
                min-height: 48px !important;
                height: 48px !important;
            }
            .nperf-select-trigger:hover {
                border-color: #E57212;
            }
            .nperf-select-label {
                font-weight: 700;
                color: #FB8521;
            }
            .nperf-select-trigger::after {
                content: "";
                width: 10px;
                height: 10px;
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
                margin: 0;
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
                flex-shrink: 0;
            }
            .nperf-select-option.selected .nperf-opt-bullet {
                background: #FB8521;
            }
            .nperf-opt-text {
                color: #FB8521;
                font-weight: 600;
                font-size: 0.95rem !important;
                line-height: 1.4 !important;
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
                padding: 0 16px !important;
                border: 1.5px solid #FB8521;
                border-radius: 12px;
                font-size: 15px !important;
                box-sizing: border-box !important;
                font-family: inherit;
                background: white;
                height: 48px !important; /* Match dropdown */
                min-height: 48px !important;
            }
            .nperf-other-input:focus {
                outline: none;
                box-shadow: 0 0 0 3px rgba(251, 133, 33, 0.2);
            }

            .nperf-btn-submit {
                margin-top: 24px;
                width: 100%;
                padding: 14px;
                background: #FB8521;
                color: white;
                border: none;
                border-radius: 12px;
                cursor: pointer;
                font-size: 16px !important;
                font-weight: 700;
                transition: background 0.2s ease;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                display: inline-flex;
                justify-content: center;
                align-items: center;
                min-height: 50px !important;
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

            /* Profile Footer Styles */
            .nperf-profile-footer {
                margin-top: 12px;
                padding: 12px 16px;
                background: #F9FAFB;
                border: 1px solid #E5E7EB;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-family: 'Roboto', sans-serif;
                color: #374151;
                font-size: 0.95rem !important;
                animation: nperfFadeIn 0.4s ease;
                box-sizing: border-box !important;
            }
            .nperf-footer-content strong {
                color: #FB8521;
                font-weight: 600;
            }
            .nperf-edit-btn {
                background: white;
                border: 1px solid #D1D5DB;
                border-radius: 8px;
                cursor: pointer;
                padding: 0 !important;
                display: flex !important;
                align-items: center;
                justify-content: center;
                color: #6B7280 !important;
                transition: all 0.2s;
                width: 32px !important;
                height: 32px !important;
                min-width: 32px;
                min-height: 32px;
                box-sizing: border-box !important;
            }
            .nperf-edit-btn:hover {
                border-color: #FB8521;
                color: #FB8521 !important;
                box-shadow: 0 2px 5px rgba(251, 133, 33, 0.15);
            }
            .nperf-edit-btn svg {
                width: 16px !important;
                height: 16px !important;
                fill: #6B7280 !important;
                display: block !important;
                min-width: 16px;
            }
            .nperf-edit-btn:hover svg {
                fill: #FB8521 !important;
            }
        `;

        this.init();
    }

    init() {
        console.log("NPerfWidget v1.0.2 loaded (API: " + this.apiBaseUrl + ")");
        this.injectStyles();
        this.createModal();
        this.renderIframe();
        // Render footer immediately (shows "Non défini" if empty)
        this.renderProfileFooter();

        this.bindEvents();
        // Do NOT show modal on init anymore
    }

    renderProfileFooter() {
        let container = typeof this.target === 'string' ? document.querySelector(this.target) : this.target;
        if (!container) return;

        // Remove existing footer if any
        const existingFooter = container.querySelector('.nperf-profile-footer');
        if (existingFooter) {
            existingFooter.remove();
        }

        // Always show footer now, even if no sector
        // if (!this.userSector) return; 

        const displaySector = this.userSector || "Non défini";
        const footerTitle = this.userSector ? "Modifier le profil" : "Définir le profil";

        const footer = document.createElement('div');
        footer.className = 'nperf-profile-footer nperf-widget-reset';
        footer.innerHTML = `
            <div class="nperf-footer-content">
                Secteur / Profil : <strong>${displaySector}</strong>
            </div>
            <button class="nperf-edit-btn" title="${footerTitle}">
                <!-- Pencil Icon -->
                <svg viewBox="0 0 24 24">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
            </button>
        `;

        // Bind Edit Click
        const editBtn = footer.querySelector('.nperf-edit-btn');
        editBtn.addEventListener('click', () => {
            this.showModal();
        });

        container.appendChild(footer);
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
        this.modal.className = 'nperf-modal nperf-widget-reset';
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
            "ARTCI",
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
            <div class="nperf-modal-content" style="position: relative;">
                <button class="nperf-close-btn" title="Fermer">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
                
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
        this.closeBtn = this.modal.querySelector('.nperf-close-btn');

        // Bind interactions
        this.closeBtn.addEventListener('click', () => {
            this.hideModal();
        });

        // Close when clicking strictly on the backdrop (outside modal content)
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });

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

        // Close dropdown on click outside
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

        // console.log("Secteur choisi:", this.userSector);

        // Update the footer to reflect new choice
        this.renderProfileFooter();

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

            // console.log("[NPerfWidget] Received action", data.action);

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

    onLoaded() { console.log("[NPerfWidget] Loaded Version 1.0.0"); }
    onReady() { /* console.log("[NPerfWidget] Ready"); */ }
    onError(type) { console.warn("[NPerfWidget] Error:", type); }
    onTestStarted() { /* console.log("[NPerfWidget] Started"); */ }

    onTestCompleted(data) {
        // console.log("[NPerfWidget] Test Completed (Raw)", data);

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
        // console.log("Processing Result with Sector:", this.userSector);
        data.userSector = this.userSector;

        // Prepare API Payload with safety checks
        const uuid = (data.device && data.device.uuid) ? data.device.uuid : (this.externalUuid || null);
        const testId = data.resultId || data.id || (data.result ? data.result.id : null) || "";

        const payload = {
            nperf_test_id: String(testId),
            external_uuid: uuid ? String(uuid) : null,
            sector: String(this.userSector || "")
        };

        console.log("Sending API Payload:", payload);

        // Send to Backend
        // Use configured API URL (auto-detected or overridden)
        const apiUrl = this.apiBaseUrl.replace(/\/$/, "") + '/api/nperf/results';

        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => {
            if (res.ok) { /* console.log("Result saved to backend."); */ }
            else console.warn("Failed to save result to backend.");
        }).catch(err => console.error("Error saving result:", err));
    }

    onGetLastResult(lastResult) {
        // console.log("[NPerfWidget] Last Result", lastResult);

        this.onTestCompleted(lastResult);
    }

    onResponsiveSwitch(data) {
        if (!this.iframe) return;
        if (data.mode == "smart") this.iframe.style.height = "500px";
        else this.iframe.style.height = "400px";
    }
}

window.NPerfWidget = NPerfWidget;