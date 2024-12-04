console.log("texte_btn_action.js loaded");

function hexToRgb(hex) {
    // Supprime le symbole # si présent
    hex = hex.replace(/^#/, "");

    // Convertit les paires hexadécimales en valeurs décimales pour RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgb(${r}, ${g}, ${b})`;
}
function bold() {
    document.execCommand("bold");
    console.log("bold");
}
function italic() {
    document.execCommand("italic");
}
function underline() {
    document.execCommand("underline");  
}
function insertUnorderedList() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        document.execCommand("insertUnorderedList");
    }
}
function insertOrderedList() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        document.execCommand("insertOrderedList");
    }
}
function justifyLeft() {
    document.execCommand("justifyLeft");
}
function justifyCenter() {
    document.execCommand("justifyCenter");
}
function justifyRight() {
    document.execCommand("justifyRight");
}
function surligne(color) {
    const selection = window.getSelection();

    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // Si le texte est déjà surligné, retire le style
        color = hexToRgb(color);
        color = color.replace("rgb", "rgba").replace(")", ", 0.5)");

        if (selection.anchorNode.parentNode.style.backgroundColor === color) {
            document.execCommand("hiliteColor", false, "transparent");
        } else {
            document.execCommand("hiliteColor", false, color);
        }

        // Déclenche manuellement l'événement 'input' pour informer des changements
        const event = new Event('input', {
            bubbles: true,
            cancelable: true,
        });
        selection.anchorNode.parentNode.dispatchEvent(event);
    }
}