/**
 *  Copyright (C) 2017 3D Repo Ltd
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

(function() {
	"use strict";

	const express = require('express');
	const router = express.Router({mergeParams: true});
	const responseCodes = require('../response_codes');
	const middlewares = require('../middlewares/middlewares');
	const Job = require("../models/job");
	const utils = require("../utils");

	router.post("/jobs", middlewares.job.canCreate, createJob);
	router.get("/myJob", middlewares.isTeamspaceMember, getUserJob);
	router.put("/jobs/:jobId", middlewares.job.canCreate, updateJob);
	router.get("/jobs", middlewares.isTeamspaceMember, listJobs);
	router.post("/jobs/:jobId/:user", middlewares.job.canCreate, addUserToJob);
	router.delete("/jobs/unassign/:user", middlewares.job.canDelete, removeUserFromJobs);
	router.delete("/jobs/:jobId", middlewares.job.canDelete, deleteJob);

	function addUserToJob(req, res, next){

		Job.addUserToJob(req.params.account, req.params.user, req.params.jobId).then(() => {
			responseCodes.respond(utils.APIInfo(req), req, res, next, responseCodes.OK, {});
		}).catch(err => {

			responseCodes.respond(utils.APIInfo(req), req, res, next, err, err);
		});

	}

	function getUserJob(req, res, next) {
		const teamspace = req.params.account;
		const user = req.session.user.username;

		//middleware checks if user is in teamspace, so this member check should not be necessary here.
		Job.findByUser(teamspace, user).then( (job) => {
		 	const result = {};
			if(job) {
				result._id = job._id;
				result.color = job.color;
			}

			responseCodes.respond(utils.APIInfo(req), req, res, next, responseCodes.OK, result);
		}).catch(err => {

			responseCodes.respond(utils.APIInfo(req), req, res, next, err, err);
		})
	}

	
	function removeUserFromJobs(req, res, next){

		Job.removeUserFromJobs(req.params.account, req.params.user).then(() => {
			responseCodes.respond(utils.APIInfo(req), req, res, next, responseCodes.OK, {});
		}).catch(err => {

			responseCodes.respond(utils.APIInfo(req), req, res, next, err, err);
		});

	}

	function createJob(req, res, next){

		const newJob = {
			_id: req.body._id,
			color: req.body.color
		};

		Job.addJob(req.params.account, newJob).then(() => {
			responseCodes.respond(utils.APIInfo(req), req, res, next, responseCodes.OK, newJob);
		}).catch(err => {

			responseCodes.respond(utils.APIInfo(req), req, res, next, err, err);
		});

	}

	function updateJob(req, res, next){
	
		if(!req.body._id) {
			return Promise.reject(responseCodes.JOB_ID_INVALID);
		}
		Job.findByJob(req.params.account, req.body._id).then( job => {
			return job.updateJob(req.body).then(() => {
				responseCodes.respond(utils.APIInfo(req), req, res, next, responseCodes.OK, {});
			});
		}).catch(err => {

			responseCodes.respond(utils.APIInfo(req), req, res, next, err, err);
		});
		
	}

	function deleteJob(req, res, next){

		Job.removeJob(req.params.account, req.params.jobId).then(() => {
			responseCodes.respond(utils.APIInfo(req), req, res, next, responseCodes.OK, {});

		}).catch(err => {

			responseCodes.respond(utils.APIInfo(req), req, res, next, err, err);
		});
	}

	function listJobs(req, res, next){
		Job.getAllJobs(req.params.account).then(jobs => {
			responseCodes.respond(utils.APIInfo(req), req, res, next, responseCodes.OK, jobs);
		}).catch(err => {

			responseCodes.respond(utils.APIInfo(req), req, res, next, err, err);
		});
	}

	module.exports = router;
}());
