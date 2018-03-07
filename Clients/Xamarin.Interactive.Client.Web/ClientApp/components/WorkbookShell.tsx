//
// Author:
//   Aaron Bockover <abock@microsoft.com>
//
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import * as matter from 'gray-matter'
import * as uuidv4 from 'uuid/v4'
import { saveAs } from 'file-saver'
import { loadTheme } from 'office-ui-fabric-react/lib/Styling';

import { osMac } from '../utils'
import { WorkbookSession, ClientSessionEvent, ClientSessionEventKind } from '../WorkbookSession'
import { WorkbookCommandBar } from './WorkbookCommandBar'
import { WorkbookEditor } from './WorkbookEditor'
import { ResultRendererRegistry } from '../ResultRendererRegistry'
import { PackageSearch } from './PackageSearch';
import { StatusMessageBar } from './StatusMessageBar';
import { StatusUIActionWithMessage, StatusUIAction, MessageKind, MessageSeverity } from '../messages'

import './WorkbookShell.scss'

export interface WorkbookShellContext {
    session: WorkbookSession
    rendererRegistry: ResultRendererRegistry
}

interface WorkbookShellState {
    isPackageDialogHidden: boolean
}

export class WorkbookShell extends React.Component<any, WorkbookShellState> {
    private shellContext: WorkbookShellContext
    private commandBar: WorkbookCommandBar | null = null
    private workbookEditor: WorkbookEditor | null = null
    private fileButton: HTMLInputElement | null = null
    private packageSearchDialog: PackageSearch | null = null
    private workbookMetadata: any
    private workspaceAvailable: boolean = false

    private initialStatusMessageBarActionMessages: StatusUIActionWithMessage[] = []
    private statusMessageBarComponent: StatusMessageBar | null = null

    constructor() {
        super()

        this.onDocumentKeyDown = this.onDocumentKeyDown.bind(this),
        this.onStatusUIAction = this.onStatusUIAction.bind(this),
        this.onClientSessionEvent = this.onClientSessionEvent.bind(this)

        this.evaluateWorkbook = this.evaluateWorkbook.bind(this)
        this.showPackageDialog = this.showPackageDialog.bind(this)
        this.triggerFilePicker = this.triggerFilePicker.bind(this)
        this.saveWorkbook = this.saveWorkbook.bind(this)
        this.dumpDraftState = this.dumpDraftState.bind(this)

        this.shellContext = {
            session: new WorkbookSession,
            rendererRegistry: ResultRendererRegistry.createDefault()
        }

        this.state = {
            isPackageDialogHidden: true
        }
    }

    private onStatusUIAction(session: WorkbookSession, actionMessage: StatusUIActionWithMessage) {
        if (this.statusMessageBarComponent) {
            this.initialStatusMessageBarActionMessages = []
            this.statusMessageBarComponent.onStatusUIAction(actionMessage)
        } else {
            this.initialStatusMessageBarActionMessages.push(actionMessage)
        }
    }

    private onClientSessionEvent(session: WorkbookSession, clientSessionEvent: ClientSessionEvent) {
        if (clientSessionEvent.kind === ClientSessionEventKind.CompilationWorkspaceAvailable) {
            this.workspaceAvailable = true
            if (this.workbookEditor)
                this.workbookEditor.setUpInitialState()
        }
    }

    async componentDidMount() {
        this.shellContext.session.statusUIActionEvent.addListener(this.onStatusUIAction)
        this.shellContext.session.clientSessionEvent.addListener(this.onClientSessionEvent)

        await this.shellContext.session.connect()

        if (this.commandBar)
            this.commandBar.setWorkbookTargets(this.shellContext.session.availableWorkbookTargets)

        document.addEventListener('keydown', this.onDocumentKeyDown)

        loadTheme({})
    }

    componentWillUnmount() {
        this.shellContext.session.statusUIActionEvent.removeListener(this.onStatusUIAction)
        this.shellContext.session.clientSessionEvent.removeListener(this.onClientSessionEvent)

        document.addEventListener('keydown', this.onDocumentKeyDown)

        this.shellContext.session.disconnect()

        this.commandBar = null
        this.workbookEditor = null
        this.fileButton = null
        this.statusMessageBarComponent = null
    }

    private onDocumentKeyDown(e: KeyboardEvent): void {
        if (!(osMac() ? e.metaKey : e.ctrlKey))
            return

        switch (e.key) {
            case 'o':
                e.preventDefault()
                if (this.workspaceAvailable)
                    this.triggerFilePicker()
                break
            case 's':
                e.preventDefault()
                if (this.workspaceAvailable)
                    this.saveWorkbook()
                break
        }
    }

    evaluateWorkbook() {
        this.shellContext.session.evaluateAll()
    }

    showPackageDialog() {
        this.setState({ isPackageDialogHidden: false })
    }

    hidePackageDialog() {
        this.setState({ isPackageDialogHidden: true })
    }

    triggerFilePicker() {
        if (this.fileButton == null)
            return;
        this.fileButton.click();
    }

    loadWorkbook(event: React.ChangeEvent<HTMLInputElement>) {
        if (event.target.files == null) {
            alert("No files.");
            return;
        }

        const file = event.target.files[0];
        const reader = new FileReader();
        reader.addEventListener("load", async () => {
            if (this.workbookEditor != null) {
                const workbookMetadata = await this.workbookEditor.loadNewContent(reader.result);
                this.workbookMetadata = workbookMetadata;
                if (workbookMetadata.packages) {
                    this.onStatusUIAction(this.shellContext.session, {
                        action: StatusUIAction.DisplayMessage,
                        message: {
                            id: 1001,
                            kind: MessageKind.Status,
                            severity: MessageSeverity.Info,
                            text: "Installing NuGet packages",
                            showSpinner: true,
                            detailedText: null
                        }
                    });
                    for (const nuget of workbookMetadata.packages) {
                        const { id, version } = nuget;
                        this.onStatusUIAction(this.shellContext.session, {
                            action: StatusUIAction.DisplayMessage,
                            message: {
                                id: 1002,
                                kind: MessageKind.Status,
                                severity: MessageSeverity.Info,
                                text: `Installing ${id} v${version}`,
                                detailedText: null,
                                showSpinner: true
                            }
                        });
                        await this.shellContext.session.installPackage(id, version);
                        this.onStatusUIAction(this.shellContext.session, {
                            action: StatusUIAction.DisplayMessage,
                            message: {
                                id: 1003,
                                kind: MessageKind.Status,
                                severity: MessageSeverity.Info,
                                text: `Installed ${id} v${version}`,
                                detailedText: null,
                                showSpinner: true
                            }
                        });
                    }
                    this.onStatusUIAction(this.shellContext.session, {
                        action: StatusUIAction.DisplayMessage,
                        message: {
                            id: 1004,
                            kind: MessageKind.Status,
                            severity: MessageSeverity.Info,
                            text: "Installed NuGet packages",
                            showSpinner: false,
                            detailedText: null
                        }
                    });
                    if (this.packageSearchDialog) {
                        this.packageSearchDialog.setState({
                            installedPackagesIds: this.packageSearchDialog.state.installedPackagesIds.concat(
                                workbookMetadata.packages.map((p: any) => p.id))
                        })
                    }
                    setTimeout(() => {
                        this.onStatusUIAction(this.shellContext.session, {
                            action: StatusUIAction.DisplayIdle
                        });
                    }, 2000);
                }
            }
        });
        reader.readAsText(file);
    }

    saveWorkbook() {
        if (this.workbookEditor != null) {
            const contentToSave = this.workbookEditor.getContentToSave();
            this.workbookMetadata = this.workbookMetadata || {
                title: "Untitled",
                uti: "com.xamarin.workbook",
                id: uuidv4(),
                platforms: this.shellContext.session.availableWorkbookTargets.map(wt => wt.id)
            };
            const workbook = matter.stringify(contentToSave, this.workbookMetadata, {
                delims: ["---", "---\n"]
            });
            var blob = new Blob([workbook], { type: "text/markdown;charset=utf-8" })
            saveAs(blob, `${this.workbookMetadata.title}.workbook`);
        }
    }

    dumpDraftState() {
        if (this.workbookEditor != null) {
            this.workbookEditor.logContent();
        }
    }

    render() {
        return (
            <div className='WorkbookShell-container'>
                <WorkbookCommandBar
                    ref={component => this.commandBar = component}
                    evaluateWorkbook={this.evaluateWorkbook}
                    addPackages={this.showPackageDialog}
                    loadWorkbook={this.triggerFilePicker}
                    saveWorkbook={this.saveWorkbook}
                    dumpDraftState={this.dumpDraftState}
                    shellContext={this.shellContext}
                />
                <StatusMessageBar
                    ref={component => this.statusMessageBarComponent = component}
                    initialActionMessages={this.initialStatusMessageBarActionMessages} />
                <PackageSearch
                    ref={component => this.packageSearchDialog = component}
                    session={this.shellContext.session}
                    notifyDismiss={() => this.hidePackageDialog()}
                    getIsHidden={() => this.state.isPackageDialogHidden}
                />
                <div className="WorkbookShell-content-container">
                    <WorkbookEditor
                        shellContext={this.shellContext}
                        ref={(editor) => this.workbookEditor = editor }
                        content='' />
                </div>
                <div style={{ display: "none" }}>
                    <input
                        type="file"
                        ref={(input) => { this.fileButton = input; }}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.loadWorkbook(e)} />
                </div>
            </div>
        )
    }
}