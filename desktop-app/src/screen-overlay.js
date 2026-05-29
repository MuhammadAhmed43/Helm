/* global TrackyMouse, electronAPI */
const message = document.getElementById("tracky-mouse-screen-overlay-message");
const actionSpan = document.getElementById("enable-disable");

const bigButton = document.createElement("button");
bigButton.style.position = "absolute";
bigButton.style.top = "0";
bigButton.style.left = "0";
bigButton.style.width = "100%";
bigButton.style.height = "100%";
bigButton.style.backgroundColor = "transparent";
bigButton.style.border = "none";
bigButton.id = "button-that-takes-up-the-entire-screen";
document.body.appendChild(bigButton);

const modeButtons = {
	left: document.getElementById("mode-left"),
	right: document.getElementById("mode-right"),
	none: document.getElementById("mode-none"),
	drag: document.getElementById("mode-drag"),
};

let dragState = "idle"; // "idle" | "holding"
let lastDragPos = { x: 0, y: 0 };

const setDragState = (state) => {
	dragState = state;
	modeButtons.drag.classList.toggle("dragging", state === "holding");
	document.body.classList.toggle("tracky-mouse-dragging", state === "holding");
};

const cancelDragIfHolding = () => {
	if (dragState === "holding") {
		electronAPI.mouseUp(lastDragPos.x, lastDragPos.y, "left");
		setDragState("idle");
	}
};

const keyboard = document.getElementById("virtual-keyboard");
const keyboardKeysContainer = document.getElementById("keyboard-keys-container");
const toggleKeyboardBtn = document.getElementById("toggle-keyboard");
const closeKeyboardBtn = document.getElementById("close-keyboard");

const keyboardLayout = [
	[
		{ label: "Esc", key: "escape", class: "modifier" },
		"1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=",
		{ label: "⌫", key: "backspace", class: "wide modifier" }
	],
	[
		{ label: "Tab", key: "tab", class: "wide modifier" },
		"q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"
	],
	[
		{ label: "Caps", key: "capslock", class: "wide modifier" },
		"a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'",
		{ label: "Enter", key: "enter", class: "extra-wide" } // removed "action" class to conform to blue style via css selector if preferred, or keep it. content: "Enter" is already styled
	],
	[
		{ label: "Shift", key: "shift", class: "extra-wide modifier" },
		"z", "x", "c", "v", "b", "n", "m", ",", ".", "/",
		{ label: "Shift", key: "shift", class: "extra-wide modifier" }
	],
	[
		{ label: "Ctrl", key: "control", class: "modifier" },
		{ label: "Alt", key: "alt", class: "modifier" },
		{ label: "", key: "space", class: "space" },
		{ label: "Alt", key: "alt", class: "modifier" },
		{ label: "Ctrl", key: "control", class: "modifier" }
	]
];

const createKeyboard = () => {
	keyboardKeysContainer.innerHTML = ""; // Clear existing
	keyboardLayout.forEach(row => {
		const rowEl = document.createElement("div");
		rowEl.className = "keyboard-row";
		row.forEach(keyData => {
			const keyEl = document.createElement("button");
			const label = typeof keyData === "string" ? keyData : keyData.label;
			const key = typeof keyData === "string" ? keyData : keyData.key;
			const extraClass = typeof keyData === "string" ? "" : keyData.class || "";

			keyEl.textContent = label;
			keyEl.className = `key ${extraClass}`;
			keyEl.dataset.key = key;
			// Store original key for shifting logic
			if (key.length === 1) {
				keyEl.dataset.original = key;
			}
			rowEl.appendChild(keyEl);
		});
		keyboardKeysContainer.appendChild(rowEl);
	});
};

createKeyboard();

let isShifted = false;
let isCaps = false;

const updateKeyboardKeys = () => {
	const keys = document.querySelectorAll(".key");
	keys.forEach(keyEl => {
		const original = keyEl.dataset.original;
		if (original) {
			let display = original;
			if (isShifted || isCaps) {
				display = display.toUpperCase();
			}

			// Handle special characters for Shift
			if (isShifted) {
				const shiftMap = {
					"1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&", "8": "*", "9": "(", "0": ")",
					"-": "_", "=": "+", "[": "{", "]": "}", "\\": "|", ";": ":", "'": "\"", ",": "<", ".": ">", "/": "?"
				};
				if (shiftMap[original]) {
					display = shiftMap[original];
				}
			}

			keyEl.textContent = display;
			keyEl.dataset.key = display; // Update the key sent
		}

		if (keyEl.dataset.key === "shift") {
			keyEl.classList.toggle("active", isShifted);
		}
		if (keyEl.dataset.key === "capslock") {
			keyEl.classList.toggle("active", isCaps);
		}
	});
};

const toggleKeyboard = (show) => {
	if (show === undefined) show = keyboard.classList.contains("hidden");
	keyboard.classList.toggle("hidden", !show);
	toggleKeyboardBtn.classList.toggle("active", show);
};

let currentClickMode = "left";

const updateModeUI = () => {
	Object.values(modeButtons).forEach(btn => btn.classList.remove("active"));
	modeButtons[currentClickMode].classList.add("active");
};

const setMode = (mode) => {
	if (currentClickMode === "drag" && mode !== "drag") {
		cancelDragIfHolding();
	}
	currentClickMode = mode;
	updateModeUI();
	console.log(`Click mode set to: ${mode}`);
};

TrackyMouse.initDwellClicking({
	targets: "#button-that-takes-up-the-entire-screen, .mode-button, .key, .keyboard-close-btn, .scroll-button",
	noCenter: (el) => el.matches("#button-that-takes-up-the-entire-screen"),
	dwellClickEvenIfPaused: (el) => el.classList.contains("mode-button") || el.classList.contains("key") || el.classList.contains("keyboard-close-btn") || el.classList.contains("scroll-button"),
	click: ({ x, y, target }) => {
		if (target.closest(".key")) {
			// Handle key clicks
			const keyEl = target.closest(".key"); // Ensure we get the button if clicked on inner element
			const key = keyEl.dataset.key;
			const original = keyEl.dataset.original;

			if (key === "shift") {
				isShifted = !isShifted;
				updateKeyboardKeys();
				return;
			}
			if (key === "capslock") {
				isCaps = !isCaps;
				updateKeyboardKeys();
				return;
			}

			// For modifiers that we don't handle typically or just press once?
			// RobotJS handles 'shift', 'alt', 'control'. 
			// If we want to HOLD them, that's complex for a dwell clicker. 
			// For now, let's treat them as press-once if they are in the layout, except Shift/Caps which update UI.

			if (key.length === 1) {
				electronAPI.keyboardType(key);
				if (isShifted) {
					isShifted = false; // Unshift after one character
					updateKeyboardKeys();
				}
			} else {
				// Special keys
				let keyName = key;
				if (key === "space") keyName = " ";
				electronAPI.keyboardPress(keyName);
			}
		} else if (target.id === "toggle-keyboard") {
			toggleKeyboard();
		} else if (target.id === "close-keyboard") {
			toggleKeyboard(false);
		} else if (target.id === "scroll-up") {
			electronAPI.mouseScroll("up");
		} else if (target.id === "scroll-down") {
			electronAPI.mouseScroll("down");
		} else if (target.classList.contains("mode-button")) {
			if (target.id === "mode-left") setMode("left");
			if (target.id === "mode-right") setMode("right");
			if (target.id === "mode-none") setMode("none");
			if (target.id === "mode-drag") setMode("drag");
		} else {
			if (currentClickMode === "drag") {
				if (dragState === "idle") {
					lastDragPos = { x, y };
					electronAPI.mouseDown(x, y, "left");
					setDragState("holding");
				} else {
					lastDragPos = { x, y };
					electronAPI.mouseUp(x, y, "left");
					setDragState("idle");
					setMode("left");
				}
			} else if (currentClickMode !== "none") {
				electronAPI.mouseClick(x, y, currentClickMode);
			}
		}
	},
});

electronAPI.onMouseMove((_event, x, y) => {
	// console.log("move-mouse", x, y);
	if (dragState === "holding") {
		lastDragPos = { x, y };
	}
	document.dispatchEvent(new Event("mouseenter"));
	const domEvent = new PointerEvent("pointermove", {
		view: window,
		clientX: x,
		clientY: y,
		pointerId: 1,
		pointerType: "mouse",
		isPrimary: true,
		button: 0,
		buttons: 1,
		bubbles: true,
		cancelable: true,
	});
	window.dispatchEvent(domEvent);
});

let wasEnabled = false;
electronAPI.onChangeDwellClicking((_event, isEnabled, isManualTakeback, cameraFeedDiagnostics) => {
	console.log("onChangeDwellClicking", isEnabled, isManualTakeback, cameraFeedDiagnostics);

	if ((!isEnabled || isManualTakeback) && dragState === "holding") {
		cancelDragIfHolding();
	}

	// Other diagnostics in the future would be stuff like:
	// - head too far away (smaller than a certain size) https://github.com/1j01/tracky-mouse/issues/49
	// - bad lighting conditions
	// see: https://github.com/1j01/tracky-mouse/issues/26

	document.body.classList.toggle("tracky-mouse-manual-takeback", isManualTakeback);
	document.body.classList.toggle("tracky-mouse-head-not-found", cameraFeedDiagnostics.headNotFound);
	actionSpan.innerText = isEnabled ? "disable" : "enable";

	if (!isEnabled && !isManualTakeback) {
		// Fade out the message after a little while so it doesn't get in the way.
		// TODO: make sure animation isn't interrupted by cameraFeedDiagnostics updates.
		message.style.animation = "tracky-mouse-screen-overlay-message-fade-out 2s ease-in-out forwards 10s";
	} else {
		message.style.animation = "";
		message.style.opacity = "1";
	}

	// "Trick" Tracky Mouse into stopping/starting the dwell clicker.
	// (TODO: can I use the return value of initDwellClicking instead? Or otherwise formalize this?)
	if (wasEnabled !== isEnabled) {
		document.dispatchEvent(new Event(isEnabled ? "mouseenter" : "mouseleave"));
		window.dispatchEvent(new Event(isEnabled ? "focus" : "blur"));
	}
	wasEnabled = isEnabled;
});
