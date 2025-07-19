import { children, createSignal, onCleanup, Show } from "solid-js";
import { deviceManager } from "./store";
import { FiBluetooth, FiMinus, FiPlus } from "solid-icons/fi";
import { IoClose } from "solid-icons/io";
import Screen from "./ui/Screen";
import { BiSolidLeftArrow, BiSolidRightArrow } from "solid-icons/bi";
import { FaSolidAngleLeft, FaSolidAngleRight } from "solid-icons/fa";

const StatusDot = ({ status }) => (
  <div
    class={`${
      {
        on: "bg-green-400",
        off: "bg-gray-600",
        wait: "animate-pulse bg-yellow-400 shadow-lg shadow-yellow-400/50",
      }[status]
    } size-4 shrink-0 rounded-md transition-colors`}
  />
);

const ConnectButton = ({ onClick }) => (
  <button
    class="flex flex-row items-center gap-x-2 rounded-md bg-blue-600 p-1.5 px-3 text-xl text-white hover:bg-blue-700"
    onClick={onClick}
  >
    <span class="text-sm font-bold tracking-wider text-gray-200">Connect</span>{" "}
    <FiBluetooth />
  </button>
);

const SettingsButton = ({ onClick }) => (
  <button
    class="flex flex-row items-center gap-x-2 rounded-md bg-gray-600 p-1.5 text-xl text-white hover:bg-gray-700"
    onClick={onClick}
  >
    {/* <span className="text-sm font-bold text-gray-200 tracking-wider">
        S
      </span>{' '} */}
    <IoClose />
  </button>
);

const Encoder = ({ onValue }) => (
  <div class="flex flex-row">
    <button
      class=" text-gray-400 font-semibold bg-gray-600 rounded-l-md px-4 py-2 border border-r border-gray-700  hover:bg-gray-700"
      onClick={() => onValue(-1)}
    >
      <FiMinus class="" />
    </button>
    <button
      class=" text-gray-400 font-semibold bg-gray-600 rounded-r-md px-4 py-2 border border-l border-gray-700 hover:bg-gray-700"
      onClick={() => onValue(+1)}
    >
      <FiPlus class="" />
    </button>
  </div>
);

const Btn = (props) => (
  <button
    class="bg-gray-600 rounded-md font-semibold text-gray-400 px-4 py-1.5  hover:bg-gray-700"
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

function App() {
  const [connected, setConnected] = createSignal(false);
  const [reconnection, setReconnection] = createSignal(false);

  deviceManager.onConnectionChange = (c) => setConnected(c);
  deviceManager.onReconnectionChange = (r) => setReconnection(r);

  onCleanup(() => {
    deviceManager.onConnectionChange = null;
    deviceManager.onReconnectionChange = null;
  });

  const simulateBtn = (which) => {
    deviceManager.sendBtn(which, true);
    setTimeout(() => deviceManager.sendBtn(which, false), 200);
  };

  const simulateEnc = (which, dir, shift) => {
    deviceManager.sendEncoder(which, dir, shift);
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-900">
      <header className="px-6 py-4 flex justify-between items-center">
        <div className="text-3xl font-semibold text-gray-300 opacity-80">
          ESP-Synth
        </div>

        <Show
          when={connected() || reconnection()}
          fallback={
            <ConnectButton onClick={() => deviceManager.connectPrompt()} />
          }
        >
          <div class="flex flex-row items-center justify-end gap-x-3">
            <StatusDot status={!reconnection() ? "on" : "wait"} />

            <span
              class={`text-md me-3 ${
                deviceManager.deviceName ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {deviceManager.deviceName || "No Device"}
            </span>

            <SettingsButton onClick={() => deviceManager.disconnect()} />
          </div>
        </Show>
      </header>

      <main className="flex-1 flex items-center justify-center">
        {/* Center Card */}
        <div className="bg-stone-800 rounded-lg shadow-lg p-4 max-w-md text-center">
          <Screen />

          {/* Commands */}
          <div class="size-full flex flex-col gap-y-4 mt-4">
            <div class="flex flex-row gap-x-2">
              <Btn onClick={() => simulateBtn("lx")}>
                <FaSolidAngleLeft />
              </Btn>
              <div class="grow" />
              <Btn onClick={() => simulateBtn("rx")}>
                <FaSolidAngleRight />
              </Btn>
            </div>

            <div class="flex flex-row gap-x-2 mt-2 justify-between">
              <Encoder onValue={(v) => simulateEnc("enc0", v, true)} />
              <Encoder onValue={(v) => simulateEnc("enc1", v, true)} />
              <Encoder onValue={(v) => simulateEnc("enc2", v, true)} />
            </div>

            <div class="flex flex-row gap-x-2 justify-between">
              <Encoder onValue={(v) => simulateEnc("enc0", v, false)} />
              <Encoder onValue={(v) => simulateEnc("enc1", v, false)} />
              <Encoder onValue={(v) => simulateEnc("enc2", v, false)} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
export default App;
