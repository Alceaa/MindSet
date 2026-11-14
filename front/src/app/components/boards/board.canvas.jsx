import { Excalidraw, exportToBlob, exportToSvg, loadFromBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

// Отдельный модуль нужен ради ленивой загрузки: Excalidraw весит больше, чем
// всё приложение, поэтому в основной бандл он попадать не должен.
export { Excalidraw, exportToBlob, exportToSvg, loadFromBlob };

export default Excalidraw;
