"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertLinesHelper = void 0;
const insertLinesHelper = (insert, target, contents, offset = 1, replace = 0) => {
    // Check that what you want to insert does not already exist
    if (!contents.includes(insert)) {
        const array = contents.split("\n");
        let newArray = [];
        if (target == "start") {
            newArray = [...array.slice(0, 1), insert, ...array.slice(1)];
        }
        else if (target == "end") {
            newArray = [...array, insert];
        }
        else {
            // Find the index of the target text you want to anchor your insert on
            let index = array.findIndex((str) => {
                return str.includes(target);
            });
            // Insert the wanted text around this anchor (i.e. offset / replace options)
            newArray = [
                ...array.slice(0, index + offset),
                insert,
                ...array.slice(index + offset + replace),
            ];
        }
        return newArray.join("\n");
    }
    else {
        return contents;
    }
};
exports.insertLinesHelper = insertLinesHelper;
