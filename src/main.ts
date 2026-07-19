import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";
import { installDevErrorReporting } from "./utils/dev-log";

installDevErrorReporting();

const app = mount(App, { target: document.getElementById("app")! });

export default app;
