import {startNordicDFU} from "./nordicdfu.js"
import {connect, disconnect, isConnected, transmitRawData} from "./bluetooth.js";
import {replRawMode, replSend} from "./repl.js";

export async function ensureConnected(onReceive, onDisconnect) {

    if (isConnected() === true) {
        return;
    }

    try {
        let connectionResult = await connect(onReceive, onDisconnect);

        if (connectionResult === "dfu connected") {
            // infoText.innerHTML = "Starting firmware update";
            await startNordicDFU()
                .catch(() => {
                    disconnect();
                    throw ("Bluetooth error. Reconnect or check console for details");
                });
            disconnect();
        }

        if (connectionResult === "repl connected") {
            // infoText.innerHTML = await checkForUpdates();
            // replResetConsole();
            return
        }
    } catch (error) {
        // Ignore User cancelled errors
        if (error.message && error.message.includes("cancelled")) {
            return;
        }
        // infoText.innerHTML = error;
        console.error(error);
    }
}

//
// window.updateFirmware = () => {
//     startFirmwareUpdate()
//         .then(() => {
//             infoText.innerHTML = "Reconnect to <b>DFUTarg</b> to begin the update";
//         })
//         .catch(error => {
//             infoText.innerHTML = error;
//         })
// }
//
// window.updateFpga = () => {
//     startFpgaUpdate()
//         .then(() => {
//             infoText.innerHTML = "FPGA update completed. Reconnect";
//         })
//         .catch(error => {
//             infoText.innerHTML = error;
//         })
// }
//
// export function reportUpdatePercentage(percentage) {
//     infoText.innerHTML = "Updating " + percentage.toFixed(2) + "%";
// }
//