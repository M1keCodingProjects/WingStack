export async function loadFile(filename) {
    if(!filename) return "";
    filename += ".GL";
    const file = await fetch(`./FILES & MODULES/${filename}`);
    return  (await file.text()).split("\r").join("");
}