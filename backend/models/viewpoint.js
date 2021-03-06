/**
 *  Copyright (C) 2018 3D Repo Ltd
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

const utils = require("../utils");
const uuid = require("node-uuid");
const responseCodes = require("../response_codes.js");
const db = require("../db/db");

const view = {};

view.findByUID = function(dbCol, uid, projection) {

	return db.getCollection(dbCol.account, dbCol.model + ".views").then((_dbCol) => {
		return _dbCol.findOne({ _id: utils.stringToUUID(uid) }, projection).then(view => {

			if (!view) {
				return Promise.reject(responseCodes.VIEW_NOT_FOUND);
			}

			return view;
		});
	});
};

view.listViewpoints = function(dbCol){

	return db.getCollection(dbCol.account, dbCol.model + ".views").then(_dbCol => {
		return _dbCol.find().toArray().then(results => {
			results.forEach((result) => {
				result._id = utils.uuidToString(result._id);
				if (result.screenshot && result.screenshot.buffer) {
					delete result.screenshot.buffer;
				}
			});
			return results;
		});
	});

};

view.getThumbnail = function(dbColOptions, uid){

	return this.findByUID(dbColOptions, uid, { "screenshot.buffer": 1 }).then(view => {
		if (!view.screenshot) {
			return Promise.reject(responseCodes.SCREENSHOT_NOT_FOUND);
		} else {
			// Mongo stores it as it's own binary object, so we need to do buffer.buffer!
			return view.screenshot.buffer.buffer;
		}
	});

};

view.updateAttrs = function(dbCol, id, data){

	const toUpdate = {};
	const fieldsCanBeUpdated = ["name"];

	// Set the data to be updated in Mongo
	fieldsCanBeUpdated.forEach((key) => {
		if (data[key]) {
			toUpdate[key] = data[key];
		}
	});

	return db.getCollection(dbCol.account, dbCol.model + ".views").then(_dbCol => {
		return _dbCol.update({_id: id}, {$set: toUpdate}).then(() => {
			return {_id: utils.uuidToString(id)};
		});
	});
};

view.createViewpoint = function(dbCol, data){
	return db.getCollection(dbCol.account, dbCol.model + ".views").then((_dbCol) => {
		let cropped;

		if (data.screenshot && data.screenshot.base64) {
			cropped = utils.getCroppedScreenshotFromBase64(data.screenshot.base64, 79, 79);
		} else {
			cropped = Promise.resolve();
		}

		return cropped.then((croppedScreenshot) => {

			const id = utils.stringToUUID(uuid.v1());

			const thumbnailUrl = `${dbCol.account}/${dbCol.model}/viewpoints/${utils.uuidToString(id)}/thumbnail.png`;

			if (croppedScreenshot) {
				// Remove the base64 version of the screenshot
				delete data.screenshot.base64;
				data.screenshot.buffer = new Buffer.from(croppedScreenshot, "base64");
				data.screenshot.thumbnail = thumbnailUrl;
			}

			const newViewpoint = {
				_id: id,
				clippingPlanes: data.clippingPlanes,
				viewpoint: data.viewpoint,
				screenshot: data.screenshot
			};

			return _dbCol.insert(newViewpoint).then(() => {
				return this.updateAttrs(dbCol, id, data).catch((err) => {
					// remove the recently saved new view as update attributes failed
					return this.deleteViewpoint(dbCol, id).then(() => {
						return Promise.reject(err);
					});
				});
			});
		});
	});
};

view.deleteViewpoint = function(dbCol, id){

	if ("[object String]" === Object.prototype.toString.call(id)) {
		id = utils.stringToUUID(id);
	}

	return db.getCollection(dbCol.account, dbCol.model + ".views").then((_dbCol) => {
		return _dbCol.findOneAndDelete({ _id : id}).then((deleteResponse) => {
			if(!deleteResponse.value) {
				return Promise.reject(responseCodes.VIEW_NOT_FOUND);
			}
		});
	});
};

module.exports = view;
