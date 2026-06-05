import { AsyncLocalStorage } from "async_hooks";

export const authStore = new AsyncLocalStorage();