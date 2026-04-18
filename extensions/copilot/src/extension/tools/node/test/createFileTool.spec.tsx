/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, expect, suite, test } from 'vitest';
import type { ChatResponseStream } from 'vscode';
import { ITestingServicesAccessor } from '../../../../platform/test/node/services';
import { TestWorkspaceService } from '../../../../platform/test/node/testWorkspaceService';
import { IWorkspaceService } from '../../../../platform/workspace/common/workspaceService';
import { createTextDocumentData } from '../../../../util/common/test/shims/textDocument';
import { CancellationToken } from '../../../../util/vs/base/common/cancellation';
import { URI } from '../../../../util/vs/base/common/uri';
import { SyncDescriptor } from '../../../../util/vs/platform/instantiation/common/descriptors';
import { createExtensionUnitTestingServices } from '../../../test/node/services';
import { ToolName } from '../../common/toolNames';
import { CopilotToolMode } from '../../common/toolsRegistry';
import { IToolsService } from '../../common/toolsService';
import { ICreateFileParams } from '../createFileTool';

suite('CreateFile', () => {
	let accessor: ITestingServicesAccessor;

	beforeAll(() => {
		// A document that is live in memory but whose backing file has been
		// deleted from disk (MockFileSystemService throws ENOENT for unregistered URIs).
		// This models the scenario in https://github.com/microsoft/vscode/issues/311043
		// where `rm` in a terminal removed the file but VS Code still has the buffer open.
		const staleDoc = createTextDocumentData(
			URI.file('/workspace/stale.md'),
			'# old heading\n\nold body that should not leak into the new file\n',
			'markdown',
		).document;

		const services = createExtensionUnitTestingServices();
		services.define(IWorkspaceService, new SyncDescriptor(
			TestWorkspaceService,
			[
				[URI.file('/workspace')],
				[staleDoc],
			],
		));
		accessor = services.createTestingAccessor();
	});

	afterAll(() => {
		accessor.dispose();
	});

	async function invoke(params: ICreateFileParams) {
		const stream: Partial<ChatResponseStream> = {
			markdown: () => { },
			codeblockUri: () => { },
			push: () => { },
			textEdit: () => { },
		};
		const toolsService = accessor.get(IToolsService);
		await toolsService.getCopilotTool(ToolName.CreateFile)?.resolveInput?.(params, { stream } as any, CopilotToolMode.FullContext);
		return toolsService.invokeTool(ToolName.CreateFile, { input: params, toolInvocationToken: null as never }, CancellationToken.None);
	}

	test('rejects create when file is absent on disk but a stale in-memory doc has content (#311043)', async () => {
		const params: ICreateFileParams = {
			filePath: '/workspace/stale.md',
			content: '# new heading\n\nnew body\n',
		};

		await expect(invoke(params)).rejects.toThrow(/File already exists/);
	});
});
