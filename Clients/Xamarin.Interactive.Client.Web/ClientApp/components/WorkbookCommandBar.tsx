//
// Author:
//   Aaron Bockover <abock@microsoft.com>
//
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react';
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar';
import { IContextualMenuItem } from 'office-ui-fabric-react/lib/ContextualMenu';

import { WorkbookTarget, DotNetSdk, WorkbookSession, ClientSessionEvent, ClientSessionEventKind } from '../WorkbookSession'
import { WorkbookShellContext } from './WorkbookShell';

const evaluateWorkbookItem: IContextualMenuItem = {
    key: 'evaluateWorkbook',
    name: 'Run All',
    icon: 'Play',
    onClick: () => { }
}

const addPackagesItem: IContextualMenuItem = {
    key: 'addPackage',
    name: 'NuGet',
    icon: 'Add',
    onClick: () => { }
}

const openWorkbookItem: IContextualMenuItem = {
    key: 'openWorkbook',
    name: 'Open',
    icon: 'OpenFile',
    onClick: () => { },
    disabled: true,
}

const saveWorkbookItem: IContextualMenuItem = {
    key: 'saveWorkbook',
    name: 'Save',
    icon: 'DownloadDocument',
    onClick: () => { }
}

const overflowItems: IContextualMenuItem[] = [
    openWorkbookItem,
    saveWorkbookItem
]

const dumpDraftState: IContextualMenuItem = {
    key: 'dumpDraftState',
    icon: 'Rocket',
    onClick: () => { }
}

const farItems: IContextualMenuItem[] = [
    // dumpDraftState
]

interface WorkbookCommandBarProps {
    evaluateWorkbook: () => void
    addPackages: () => void
    loadWorkbook: () => void
    saveWorkbook: () => void
    dumpDraftState: () => void
    shellContext: WorkbookShellContext
}

interface WorkbookCommandBarState {
    items: IContextualMenuItem[]
    overflowItems: IContextualMenuItem[]
}

export class WorkbookCommandBar extends React.Component<WorkbookCommandBarProps, WorkbookCommandBarState> {
    constructor(props: WorkbookCommandBarProps) {
        super(props)

        this.onClientSessionEvent = this.onClientSessionEvent.bind(this)

        this.state = {
            items: [
                evaluateWorkbookItem,
                addPackagesItem
            ],
            overflowItems
        }

        evaluateWorkbookItem.onClick = props.evaluateWorkbook
        addPackagesItem.onClick = props.addPackages
        saveWorkbookItem.onClick = props.saveWorkbook
        openWorkbookItem.onClick = props.loadWorkbook
        dumpDraftState.onClick = props.dumpDraftState
    }

    private onClientSessionEvent(session: WorkbookSession, clientSessionEvent: ClientSessionEvent) {
        if (clientSessionEvent.kind === ClientSessionEventKind.CompilationWorkspaceAvailable) {
            const overflowItems = this.state.overflowItems;
            const openWorkbookItem = overflowItems.find(mi => mi.key === "openWorkbook");
            if (!openWorkbookItem)
                return
            openWorkbookItem.disabled = false;
            this.setState({ overflowItems })
        }
    }

    componentDidMount() {
        this.props.shellContext.session.clientSessionEvent.addListener(this.onClientSessionEvent)
    }

    componentWillUnmount() {
        this.props.shellContext.session.clientSessionEvent.removeListener(this.onClientSessionEvent)
    }

    setWorkbookTargets(targets: WorkbookTarget[]) {
        let targetItems: IContextualMenuItem[] = []
        for (const target of targets)
            targetItems.push({
                key: target.id,
                name: `${target.flavor} (${(target.sdk as any).Name})`
            })

        this.setState({
            items: [
                {
                    key: 'workbookTarget',
                    name: 'Mono: .NET Framework',
                    icon: 'CSharpLanguage',
                    subMenuProps: {
                        items: targetItems
                    }
                },
                evaluateWorkbookItem,
                addPackagesItem
            ]
        })
    }

    render() {
        return (
            <CommandBar
                elipisisAriaLabel='More options'
                items={this.state.items}
                overflowItems={this.state.overflowItems}
                farItems={farItems}
            />
        );
    }
}