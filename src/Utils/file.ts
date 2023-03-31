/* eslint-disable indent */
'use strict';
import { exec } from 'child_process';
export async function deleteDir(dirname) {
    return new Promise((resolve, reject) => {
        exec(`rm -rf ${dirname}`, (err, stdout, srderr) => {
            if (err) {
                reject(srderr);
            } else {
                resolve(stdout);
            }
        });
    });
}

export async function createDir(dirpath, deleteFirst = true) {
    if (deleteFirst) await deleteDir(dirpath);
    return new Promise((resolve, reject) => {
        exec(`mkdir -p ${dirpath}`, (err, stdout, srderr) => {
            if (err) {
                reject(srderr);
            } else {
                resolve(stdout);
            }
        });
    });

}

