export function getFolderName() {
    const d = new Date();
    return `${d.getFullYear().toString().substring(2)}_${d.getMonth()}_${d.getDate()}_${d.getHours()}_${d.getMinutes()}`;
}