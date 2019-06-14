'use strict';

import * as vscode from 'vscode';
import { parse } from 'querystring';

export function activate(context: vscode.ExtensionContext) {
	checkTextDocument(vscode.window.activeTextEditor);
	vscode.window.onDidChangeActiveTextEditor(textEditor => checkTextDocument(textEditor));
}

function checkTextDocument(textEditor: vscode.TextEditor | undefined) {
	if (textEditor != undefined && isSalesforceObjectFile(textEditor.document)) {
		if (!isValid(textEditor.document)) {
			let message = 'It seems that your Dependent Picklists have unsorted "valueSettings". Would you like to sort them alphabetically?';
			vscode.window.showInformationMessage(message, ...[ "Sort", "Cancel" ]).then(clickedItem => onItemClicked(textEditor, clickedItem), () => {});
		}
	}

	function onItemClicked(textEditor: vscode.TextEditor, item: string | undefined) {
		if (item != 'Sort' || textEditor != vscode.window.activeTextEditor) {
			return;
		}

		let sortedText = getSortedText(textEditor.document);
		var firstLine = textEditor.document.lineAt(0);
		var lastLine = textEditor.document.lineAt(textEditor.document.lineCount - 1);
		var textRange = new vscode.Range(0, firstLine.range.start.character, textEditor.document.lineCount - 1, lastLine.range.end.character);
		textEditor.edit((editBuilder) => editBuilder.replace(textRange, sortedText));
	}
}

function isValid(textDocument: vscode.TextDocument): boolean {
	let isSorted = true;
	let xmlToJson = require('fast-xml-parser');
	let jsonDocument = xmlToJson.parse(textDocument.getText(), { });
	(<ICustomObject>jsonDocument.CustomObject).fields.forEach(function (field) {
		if (!isSorted || field.type != 'Picklist') {
			return;
		}

		let picklistField = <IPicklistField>field;
		if (picklistField.valueSet == undefined){
			return;
		}
		if (picklistField.valueSet.controllingField == undefined){
			return;
		}

		const originalValueSettingsList  = Object.assign([], picklistField.valueSet.valueSettings);
		picklistField.valueSet.valueSettings.sort(sortValueSettings);

		isSorted = equals(originalValueSettingsList, picklistField.valueSet.valueSettings);
	});
	return isSorted;
}

function getSortedText(textDocument: vscode.TextDocument): string {
	let xmlToJson = require('fast-xml-parser');
	let jsonDocument = xmlToJson.parse(textDocument.getText(), { attrNodeName: "attr", attributeNamePrefix : "", ignoreAttributes : false });
	(<ICustomObject>jsonDocument.CustomObject).fields.forEach(function (field) {
		if (field.type != 'Picklist') {
			return;
		}

		let picklistField = <IPicklistField>field;
		if (picklistField.valueSet == undefined){
			return;
		}
		if (picklistField.valueSet.controllingField == undefined){
			return;
		}
		picklistField.valueSet.valueSettings.sort(sortValueSettings);
	});

	var JsonToXmlParser = require("fast-xml-parser").j2xParser;
	var xmlDocument = new JsonToXmlParser({ attrNodeName: "attr", format: true, indentBy: "    " }).parse(jsonDocument);
	return '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlDocument;
}

function equals(array1: Array<IValueSetting>, array2: Array<IValueSetting>): boolean {
	for (let i = 0; i < array1.length; i++) {
		if (array1[i].valueName != array2[i].valueName) {
			return false;
		}
	}
	return true;
}

function sortValueSettings(valueSetting1: IValueSetting, valueSetting2: IValueSetting) {
	if (valueSetting1.valueName < valueSetting2.valueName) {
		return -1;
	} if (valueSetting1.valueName > valueSetting2.valueName) {
		return 1;
	} else {
		return 0;
	}
}

function isSalesforceObjectFile(textDocument: vscode.TextDocument): boolean {
	if (!textDocument.fileName.endsWith(".object")) {
		return false;
	}
	if (textDocument.getText(new vscode.Range(0, 0, 0, 40)) != '<?xml version="1.0" encoding="UTF-8"?>') {
		return false;
	}
	if (textDocument.getText(new vscode.Range(1, 0, 1, 62)) != '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">') {
		return false;
	}
	return true;
}

interface ICustomObject {
	type: string;
	fields: Array<IField>
}

interface IField {
	type: string;
}

interface IPicklistField {
	type: string;
	valueSet: { controllingField: object; valueSettings: Array<{ valueName: string; controllingFieldValue: Array<String> }> }
}

interface IValueSetting {
	valueName: string;
	controllingFieldValue: Array<String>
}