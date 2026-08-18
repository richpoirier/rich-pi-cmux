import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import cmuxNotifyExtension from "../extensions/cmux-notify.ts";
import cmuxSidebarExtension from "../extensions/cmux-sidebar.ts";

type EventHandler = (event: Record<string, unknown>, context: ExtensionContext) => Promise<unknown> | unknown;

interface ExecCall {
	command: string;
	args: string[];
}

const managedEnvironment = [
	"CMUX_WORKSPACE_ID",
	"PI_CMUX_NOTIFY_LEVEL",
	"PI_CMUX_NOTIFY_THRESHOLD_MS",
	"PI_CMUX_SIDEBAR_COMPLETE_THRESHOLD_MS",
	"PI_CMUX_SIDEBAR_FINAL_CLEAR_MS",
	"PI_CMUX_SIDEBAR_FLASH",
	"PI_CMUX_SIDEBAR_TOKENS",
] as const;

const originalEnvironment = new Map(managedEnvironment.map((name) => [name, process.env[name]]));

afterEach(() => {
	for (const name of managedEnvironment) {
		const value = originalEnvironment.get(name);
		if (value === undefined) {
			delete process.env[name];
		} else {
			process.env[name] = value;
		}
	}
});

function createHarness() {
	const handlers = new Map<string, EventHandler[]>();
	const execCalls: ExecCall[] = [];
	const context = {
		sessionManager: {
			getBranch: () => [],
		},
	} as unknown as ExtensionContext;

	const pi = {
		on(event: string, handler: EventHandler) {
			const eventHandlers = handlers.get(event) ?? [];
			eventHandlers.push(handler);
			handlers.set(event, eventHandlers);
		},
		async exec(command: string, args: string[]) {
			execCalls.push({ command, args });
			return { code: 0, stdout: "", stderr: "", killed: false };
		},
	} as unknown as ExtensionAPI;

	const emit = async (type: string, event: Record<string, unknown> = {}): Promise<void> => {
		for (const handler of handlers.get(type) ?? []) {
			await handler({ type, ...event }, context);
		}
	};

	return { pi, emit, execCalls };
}

function assistantMessage(stopReason: "stop" | "error", errorMessage?: string) {
	return {
		role: "assistant",
		stopReason,
		errorMessage,
		content: [],
	};
}

function successfulWrite(path: string) {
	return {
		toolName: "write",
		toolCallId: "write-1",
		input: { path },
		content: [{ type: "text", text: "Wrote file" }],
		details: {},
		isError: false,
	};
}

function getArgument(args: string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

async function drainQueuedCommands(): Promise<void> {
	for (let index = 0; index < 4; index += 1) {
		await new Promise<void>((resolve) => setImmediate(resolve));
	}
}

test("notification preserves activity until settlement after a retry", async () => {
	process.env.PI_CMUX_NOTIFY_LEVEL = "medium";
	delete process.env.PI_CMUX_NOTIFY_THRESHOLD_MS;
	const harness = createHarness();
	cmuxNotifyExtension(harness.pi);

	await harness.emit("before_agent_start", { prompt: "Update the file" });
	await harness.emit("agent_start");
	await harness.emit("tool_result", successfulWrite("/tmp/first-attempt.ts"));
	await harness.emit("agent_end", {
		messages: [assistantMessage("error", "Anthropic stream ended before message_stop")],
	});
	assert.equal(harness.execCalls.length, 0);

	await harness.emit("agent_start");
	await harness.emit("agent_end", { messages: [assistantMessage("stop")] });
	assert.equal(harness.execCalls.length, 0);

	await harness.emit("agent_settled");
	assert.equal(harness.execCalls.length, 1);
	assert.equal(harness.execCalls[0]?.command, "cmux");
	assert.equal(getArgument(harness.execCalls[0]?.args ?? [], "--subtitle"), "Task Complete");
	assert.equal(getArgument(harness.execCalls[0]?.args ?? [], "--body"), "Updated first-attempt.ts");
});

test("notification reports an error after final settlement", async () => {
	process.env.PI_CMUX_NOTIFY_LEVEL = "all";
	const harness = createHarness();
	cmuxNotifyExtension(harness.pi);

	await harness.emit("before_agent_start", { prompt: "Run the task" });
	await harness.emit("agent_start");
	await harness.emit("agent_end", {
		messages: [assistantMessage("error", "Anthropic stream ended before message_stop")],
	});
	assert.equal(harness.execCalls.length, 0);

	await harness.emit("agent_settled");
	assert.equal(harness.execCalls.length, 1);
	assert.equal(getArgument(harness.execCalls[0]?.args ?? [], "--subtitle"), "Error");
	assert.equal(
		getArgument(harness.execCalls[0]?.args ?? [], "--body"),
		"Anthropic stream ended before message_stop",
	);
});

test("sidebar waits for settlement before its final state", async () => {
	process.env.CMUX_WORKSPACE_ID = "workspace-test";
	delete process.env.PI_CMUX_SIDEBAR_COMPLETE_THRESHOLD_MS;
	process.env.PI_CMUX_SIDEBAR_FINAL_CLEAR_MS = "60000";
	process.env.PI_CMUX_SIDEBAR_FLASH = "disabled";
	process.env.PI_CMUX_SIDEBAR_TOKENS = "0";
	const harness = createHarness();
	cmuxSidebarExtension(harness.pi);

	await harness.emit("session_start", { reason: "startup" });
	await drainQueuedCommands();
	harness.execCalls.length = 0;

	await harness.emit("before_agent_start", { prompt: "Update the file" });
	await harness.emit("agent_start");
	await drainQueuedCommands();
	harness.execCalls.length = 0;

	await harness.emit("tool_result", successfulWrite("/tmp/first-attempt.ts"));
	await drainQueuedCommands();
	harness.execCalls.length = 0;

	await harness.emit("agent_end", {
		messages: [assistantMessage("error", "Anthropic stream ended before message_stop")],
	});
	await drainQueuedCommands();
	assert.equal(harness.execCalls.length, 0);

	await harness.emit("agent_start");
	await drainQueuedCommands();
	harness.execCalls.length = 0;
	await harness.emit("agent_end", { messages: [assistantMessage("stop")] });
	await drainQueuedCommands();
	assert.equal(harness.execCalls.length, 0);

	await harness.emit("agent_settled");
	await drainQueuedCommands();
	assert.ok(
		harness.execCalls.some(
			(call) => call.args[0] === "set-status" && call.args.includes("Pi done"),
		),
	);
	assert.ok(
		harness.execCalls.some(
			(call) => call.args[0] === "set-progress" && call.args[1] === "1.00" && call.args.includes("Done"),
		),
	);
	assert.ok(
		harness.execCalls.some(
			(call) => call.args[0] === "log" && call.args.includes("Updated first-attempt.ts"),
		),
	);

	await harness.emit("session_shutdown", { reason: "quit" });
	await drainQueuedCommands();
});

test("sidebar finalizes from OMP agent_end without breaking retries", async () => {
	process.env.CMUX_WORKSPACE_ID = "workspace-test";
	delete process.env.PI_CMUX_SIDEBAR_COMPLETE_THRESHOLD_MS;
	process.env.PI_CMUX_SIDEBAR_FINAL_CLEAR_MS = "60000";
	process.env.PI_CMUX_SIDEBAR_FLASH = "disabled";
	process.env.PI_CMUX_SIDEBAR_TOKENS = "0";
	const harness = createHarness();
	cmuxSidebarExtension(harness.pi);

	await harness.emit("session_start", { reason: "startup" });
	await harness.emit("before_agent_start", { prompt: "Update the file" });
	await harness.emit("agent_start");
	await harness.emit("turn_start", { turnIndex: 0 });
	await harness.emit("tool_result", successfulWrite("/tmp/omp-settle.ts"));
	await drainQueuedCommands();
	harness.execCalls.length = 0;

	await harness.emit("agent_end", {
		messages: [assistantMessage("error", "retryable stream failure")],
		willContinue: true,
	});
	await drainQueuedCommands();
	assert.equal(harness.execCalls.length, 0);

	await harness.emit("agent_start");
	await drainQueuedCommands();
	harness.execCalls.length = 0;

	await harness.emit("agent_end", { messages: [assistantMessage("stop")], willContinue: undefined });
	await drainQueuedCommands();
	assert.ok(
		harness.execCalls.some(
			(call) => call.args[0] === "set-progress" && call.args[1] === "1.00" && call.args.includes("Done"),
		),
	);

	await harness.emit("session_shutdown", { reason: "quit" });
	await drainQueuedCommands();
});
