export const THEME_STORAGE_KEY = "lumora-theme"

/**
 * Runs in <head> before first paint so the saved theme is applied without a flash.
 * Dark is the default; an explicit choice in localStorage wins.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=document.documentElement;if(t==="light"){d.classList.remove("dark")}else{d.classList.add("dark")}}catch(e){}})()`
