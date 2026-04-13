/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { mainWindow } from '../../base/browser/window.js';

export type MobileNavigationLayer = 'sidebar' | 'editor' | 'panel' | 'auxbar';

interface MobileNavigationEntry {
	readonly layer: MobileNavigationLayer;
	readonly id: number;
}

/**
 * Manages a stack of open overlay layers (sidebar, editor modal, panel sheet,
 * aux bar) and integrates with `history.pushState` / `popstate` so that the
 * Android back button dismisses overlays in LIFO order.
 */
export class MobileNavigationStack extends Disposable {

	private readonly _stack: MobileNavigationEntry[] = [];
	private _nextId = 0;

	private readonly _onDidPop = this._register(new Emitter<MobileNavigationLayer>());
	readonly onDidPop: Event<MobileNavigationLayer> = this._onDidPop.event;

	constructor() {
		super();

		this._register(Event.fromDOMEventEmitter<PopStateEvent>(mainWindow, 'popstate')(e => {
			this._onPopState(e);
		}));
	}

	push(layer: MobileNavigationLayer): void {
		const id = this._nextId++;
		this._stack.push({ layer, id });
		mainWindow.history.pushState({ layer, id }, '');
	}

	pop(): MobileNavigationLayer | undefined {
		const entry = this._stack.pop();
		if (entry) {
			this._onDidPop.fire(entry.layer);
		}
		return entry?.layer;
	}

	peek(): MobileNavigationLayer | undefined {
		return this._stack.length > 0
			? this._stack[this._stack.length - 1].layer
			: undefined;
	}

	has(layer: MobileNavigationLayer): boolean {
		return this._stack.some(e => e.layer === layer);
	}

	clear(): void {
		this._stack.length = 0;
	}

	private _onPopState(e: PopStateEvent): void {
		if (this._stack.length === 0) {
			return;
		}

		const top = this._stack[this._stack.length - 1];
		const state = e.state as { layer?: string; id?: number } | null;

		// Only pop if the event's state id matches expectations —
		// the popstate must correspond to a state *before* our top entry,
		// meaning the top entry's push was just undone.
		if (state && typeof state.id === 'number' && state.id >= top.id) {
			return;
		}

		this.pop();
	}
}
