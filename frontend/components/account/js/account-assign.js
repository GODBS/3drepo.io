/**
 *	Copyright (C) 2016 3D Repo Ltd
 *
 *	This program is free software: you can redistribute it and/or modify
 *	it under the terms of the GNU Affero General Public License as
 *	published by the Free Software Foundation, either version 3 of the
 *	License, or (at your option) any later version.
 *
 *	This program is distributed in the hope that it will be useful,
 *	but WITHOUT ANY WARRANTY; without even the implied warranty of
 *	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *	GNU Affero General Public License for more details.
 *
 *	You should have received a copy of the GNU Affero General Public License
 *	along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function () {
	"use strict";

	angular.module("3drepo")
		.component("accountAssign", {
			restrict: "EA",
			templateUrl: "templates/account-assign.html",
			bindings: {
				account: "="
			},
			controller: accountAssignCtrl,
			controllerAs: "vm"
		});

	accountAssignCtrl.$inject = [
		"$scope", "$window", "$q", 
		"$mdDialog", "$location", "APIService"
	];

	function accountAssignCtrl(
		$scope, $window, $q, $mdDialog, 
		$location, APIService
	) {
		var vm = this;

		// TODO: All of this probably needs simplifying and definitely needs abstracting
		// to a service. I am not sure if the assign user logic is actually right

		/*
		 * Init
		 */	
		vm.$onInit = function() {
			vm.loadingTeamspaces = true;
			vm.modelReady = false;
			vm.teamspaces = [];
			vm.projects = {};
			vm.models = [];
			vm.selectedRole = {};

			vm.check = $location.search();
			vm.isFromUrl = vm.check.account && vm.check.project && vm.check.model;
			if (vm.isFromUrl) {
				vm.selectedIndex = 2;
			}
			vm.getTeamspaces();

			vm.teamspacePermissions = {

				teamspace_admin : "Admin",
				// assign_licence	: "Assign Licence",
				// revoke_licence	: "Revoke Licence",
				// create_project	: "Create Project",
				// create_job	: "Create Job",
				// delete_job	: "Delete Job",
				// assign_job : "Assign Job"

			};

			vm.projectPermissions = {
				// create_model : "Create Model",
				// create_federation : "Create Federation",
				// delete_project : "Delete Project",
				// edit_project :  "Edit Project",
				admin_project : "Admin Project"
			};

			vm.modelRoles = ["unassigned"];
			
		};

		vm.resetState = function() {
			vm.fromURL = {};
			$location.search("account", null);
			$location.search("project", null);
			$location.search("model", null);
			vm.checkIfAdminChanged();
		};

		vm.getStateFromParams = function() {
			
			if (vm.check) {
				vm.fromURL = {};
				vm.fromURL.projectSelected = vm.check.project;
				vm.fromURL.modelSelected = vm.check.model;

				// Trigger the first watcher (teamspace)
				vm.teamspaceSelected = vm.check.account;
			}

		};


		// TEAMSPACES

		vm.teamspaceAdmin = "teamspace_admin";

		vm.teamspacesToAssign = function() {
			return vm.selectedTeamspace && 
					vm.selectedTeamspace.teamspacePermissions && 
					(vm.selectedTeamspace.teamspacePermissions.length === 0 || 
						(vm.selectedTeamspace.teamspacePermissions.length === 1 && 
						vm.selectedTeamspace.teamspacePermissions[0].user === vm.account)
					);
		};

		vm.teamspaceAdminDisabled = function(user, permission) {
			return (permission !== vm.teamspaceAdmin && vm.userHasPermissions(user, vm.teamspaceAdmin)) || 
					vm.selectedTeamspace.account == user.user;
		};

		vm.teamspaceAdminChecked = function(user, permission) {
			return vm.userHasPermissions(user, vm.teamspaceAdmin) || 
					vm.userHasPermissions(user, permission);
		};

		vm.adminstrableTeamspaces = function(teamspaces) {
			var permission = vm.teamspaceAdmin;
			return teamspaces.filter(function(teamspace){
				return teamspace.permissions.indexOf(permission) !== -1;
			});
		};

		vm.adminstrableProjectTeamspaces = function(teamspaces) {
			var permission = "admin_project";
			return teamspaces.filter(function(teamspace){
				var hasAdminstrableProject = false;
				teamspace.projects.forEach(function(project){
					if (project.permissions.indexOf(permission) !== -1) {
						hasAdminstrableProject = true;
					}
				});	
				return hasAdminstrableProject;
			});
		};

		vm.getTeamspaces = function() {
			
			var accountUrl = vm.account + ".json";

			APIService.get(accountUrl)
				.then(function(response) {

					vm.teamspaces = response.data.accounts;
					vm.getStateFromParams();
					vm.loadingTeamspaces = false;
					
				})
				.catch(function (error) {
					var title = "Issue Getting Teamspaces";
					vm.showError(title, error);
				});
		};

		vm.postTeamspacePermissionChange = function(user, permission, addOrRemove) {

			if (user) {
				// Add or remove a permission
				if (addOrRemove === "add") {
					user.permissions.push(permission); 
				} else {
					var index = user.permissions.indexOf(permission);
					if (index > -1) {
						user.permissions.splice(index, 1);
					}
				}

				// Update the permissions user for the selected teamspace
				var url = vm.selectedTeamspace.account + "/permissions/";
				
				var permissionData = {
					user : user.user,
					permissions: user.permissions
				};

				// Move them to unassigned role if we remove there admin privilidges
				if (permission === "teamspace_admin" && vm.modelRoles && vm.modelRoles.length > 1) {
					vm.selectedRole[user.user] = "unassigned";
				}

				vm.checkIfAdminChanged();

				APIService.post(url, permissionData)
					.catch(function(error){
						var title = "Issue Updating Teamspace Permissions";
						vm.showError(title, error);
					});

			} else {
				console.error("User data is corrupt: ", user, permission, addOrRemove);
			}
			
		};

		vm.teamspaceStateChange = function(user, permission) {
			var addOrRemove = vm.userHasPermissions(user, permission) === true ? "remove" : "add";
			vm.postTeamspacePermissionChange(user, permission, addOrRemove);
		};

		vm.userHasPermissions = function(user, permission) {
			var hasPermissions = false;
			if(vm.selectedTeamspace.teamspacePermissions) {
				vm.selectedTeamspace.teamspacePermissions.forEach(function(permissionUser) {
					if (permissionUser.user === user.user) {
						hasPermissions = permissionUser.permissions.indexOf(permission) !== -1;
					} 
				});
			}
			
			return hasPermissions;
		};

		vm.appendTeamspacePermissions = function(teamspace) {

			var endpoint = teamspace.account + "/permissions";
			return APIService.get(endpoint)
				.then(function(response) {
					var permissionsUsers = response.data;
					teamspace.teamspacePermissions = permissionsUsers;
				})
				.catch(function(error){
					if (error.status !== 401) {
						var title = "Issue Populating Teamspace Users";
						vm.showError(title, error);
						console.error(error);
					}
				});
			
		};

		$scope.$watch("vm.teamspaceSelected", function(){

			// Teamspace has changed so we must reset all 
			// associate model and project data 
			vm.clearModelState();
			vm.clearProjectState();
		
			if (vm.teamspaces.length) {

				// Find the matching teamspace to the one selected
				vm.selectedTeamspace = vm.teamspaces.find(function(teamspace){
					return teamspace.account === vm.teamspaceSelected;
				});

				if (vm.selectedTeamspace) {
					vm.handleTeamspaceSelected()
						.then(function(permissions){
							vm.selectedTeamspace.teamspacePermissions = permissions;
						})
						.catch(function(error){
							console.error(error);
						});
				}

			}
		
		});

		vm.setPermissionTemplates = function(teamspace){

			var permissionUrl = teamspace.account + "/permission-templates";

			return APIService.get(permissionUrl)
				.then(function(response) {
					vm.modelRoles = ["unassigned"];

					response.data.forEach(function(template){
						vm.modelRoles.push(template._id);
					});
				})
				.catch(function(error){
					// We can ignore unathorised permission template attempts
					// TODO: Can't we just avoid sending the request
					if (error.status !== 401) {
						var title = "Issue Getting Permission Templates";
						vm.showError(title, error);
					}
				});

		};

		vm.handleTeamspaceSelected = function() {
			
			vm.setProjects();

			// The property is set async so it won't be there immediately
			return $q(function(resolve, reject) {
				vm.appendTeamspacePermissions(vm.selectedTeamspace)
					.then(function(){
						vm.setPermissionTemplates(vm.selectedTeamspace)
							.then(function() {
								if (vm.fromURL.projectSelected) {
									console.log("changing project selected:" , vm.fromURL);
									vm.projectSelected = vm.fromURL.projectSelected;
									delete vm.fromURL.projectSelected;
								}
								resolve(vm.selectedTeamspace.teamspacePermissions);
							});
					})
					.catch(function(error){
						var title = "Issue Populating Teamspace Permissions";
						vm.showError(title, error);
						reject(error);
					});

			});		

		};

		// PROJECTS

		vm.projectsToAssign = function() {
			return vm.selectedProject && 
					vm.selectedProject.userPermissions && 
					vm.selectedProject.userPermissions.length === 0;
		};

		vm.adminChecked = function(user, permission) {
			return vm.userHasProjectPermissions(user, permission) ||
					vm.userHasProjectPermissions(user, "admin_project") ||
					vm.userHasPermissions(user, "teamspace_admin");
		};

		vm.adminDisabled = function(user, permission) {
			return (permission !== "admin_project" && 
				vm.userHasProjectPermissions(user, "admin_project")) || 
				vm.userHasPermissions(user, "teamspace_admin");
		};

		vm.setProjects = function() {

			vm.projects = {};
			vm.selectedTeamspace.projects.forEach(function(project){
				vm.projects[project.name] = project;
			});

		};

		vm.clearProjectState = function() {
			vm.projectSelected = undefined;
			vm.selectedProject = undefined;
		};

		$scope.$watch("vm.projectSelected", function(){
			// Find the matching project to the one selected

			if (vm.projectSelected) {
				vm.selectedProject = vm.projects[vm.projectSelected];

				var endpoint = vm.selectedTeamspace.account +
								"/projects/" + vm.projectSelected;

				// We can use the current users object as its matches the required 
				// data structure the API expects
				APIService.get(endpoint)
					.then(vm.handleProjectSelected)
					.catch(function(error) {
						console.error(error);
						var title = "Issue Getting Project Permissions";
						vm.showError(title, error);
					});
		
			}
			
		});

		vm.handleProjectSelected = function(response){
			
			vm.selectedProject.userPermissions = response.data.permissions;

			// We should put the teamspace owner in the list if they 
			// aren't in it already
			if (vm.selectedProject.userPermissions.length === 0 
				&& vm.selectedTeamspace.account === vm.account) {

				vm.selectedProject.userPermissions.push({
					permissions: ["admin_project"],
					user : vm.account
				});

			}
			

			// Reset the models
			vm.clearModelState();
			var projectSelected = vm.teamspaceSelected && vm.projectSelected;
			var projectReady = vm.selectedProject && vm.selectedProject.models;

			if (projectSelected && projectReady) {

				vm.models = vm.selectedProject.models.sort(vm.sortModels);

				if (vm.fromURL.modelSelected && vm.fromURL.modelSelected) {
					vm.modelSelected = vm.fromURL.modelSelected;
					delete vm.fromURL.modelSelected;
				}

			} 

		};

		vm.projectStateChange = function(user, permission) {
			var hasPermission = vm.userHasProjectPermissions(user, permission);
			var addOrRemove = hasPermission === true ? "remove" : "add";
			vm.postProjectPermissionChange(user, permission, addOrRemove);
		};

		vm.userHasProjectPermissions = function(user, permission) {
			
			var hasPermission = false;

			if (vm.selectedProject && vm.selectedProject.userPermissions) {
				// Loop through all the project users and see if they have 
				// permissions. If so we can set the tick box to checked
				
				vm.selectedProject.userPermissions.forEach(function(permissionUser){
					if (permissionUser.user === user.user) {
						var userPermissions = permissionUser.permissions;
						if (userPermissions) {
							hasPermission = userPermissions.indexOf(permission) !== -1;
						}
					}
				});
			}
			
			return hasPermission;
		};

		vm.postProjectPermissionChange = function(user, permission, addOrRemove) {

			//Add or remove a permission
			if (addOrRemove === "add" || addOrRemove === "remove") {

				var targetUser = vm.selectedProject.userPermissions.find(function(projectUser){
					return projectUser.user === user.user;
				});

				if (addOrRemove === "add") {

					if (targetUser) {
						// If the user is already in the list we can add the persmission
						if (targetUser.permissions.indexOf(permission) === -1) {
							targetUser.permissions.push(permission);
						}
					} else {
						// Else we create a new object and add it in
						vm.selectedProject.userPermissions.push({
							user : user.user,
							permissions: [permission]
						});
					}
					
				} else if (addOrRemove === "remove") {

					// If we are removing the permission
					if (targetUser) {
						
						// If the user is already in the list we can add the persmission
						var index = targetUser.permissions.indexOf(permission);
						if (index !== -1) {
							targetUser.permissions.splice(index, 1);
						}

						// Move them to unassigned role if we remove there admin privilidges
						if (permission === "admin_project" && vm.modelRoles && vm.modelRoles.length > 1) {
							vm.selectedRole[user.user] = "unassigned";
						}

					} 
					
				} 

				//Update the permissions user for the selected teamspace
				var endpoint = vm.selectedTeamspace.account + 
								"/projects/" + vm.selectedProject.name;
				
				APIService.put(endpoint, {
					permissions: vm.selectedProject.userPermissions
				}).catch(function(error){
					var title = "Issue Updating Project Permissions";
					vm.showError(title, error);
				});

				// Check if we removed or added an admins
				vm.checkIfAdminChanged();

			}

		};

		// MODELS
		
		vm.isProjectAdmin = function(user) {

			var userObj;
			if (typeof(user) === "string") {
				userObj = {user: user};
			} else {
				userObj = user;
			}

			return vm.userHasProjectPermissions(userObj, "admin_project");

		};

		vm.isTeamspaceAdmin = function(user) {

			var userObj;
			if (typeof(user) === "string") {
				userObj = {user: user};
			} else {
				userObj = user;
			}

			return vm.userHasPermissions(userObj, "teamspace_admin");
					

		};

		vm.modelUsersToAssign = function() {
			return vm.modelSelected && vm.selectedRole && Object.keys(vm.selectedRole).length === 0;
		};

		vm.modelUserValid = function(user) {
			return vm.selectedTeamspace.account == user || vm.account == user;
		};

		vm.modelDataReady = function() {
			return (!vm.isFromUrl && !vm.loadingTeamspaces && !vm.projectsLoading) ||
					(vm.isFromUrl && vm.modelReady);
		};

		vm.modelsEmpty = function() {
			return Object.keys(vm.models).length === 0;
		};

		vm.modelsLoaded = function() {
			return vm.projectSelected && vm.models;
		};

		vm.clearModelState = function() {
			vm.resetSelectedModel();
			vm.modelReady = false;
			vm.modelSelected = undefined;
		};

		vm.resetSelectedModel = function() {
			vm.selectedModel = undefined;
			vm.selectedRole = {};
		};

		vm.checkIfAdminChanged = function() {
	
			if (vm.selectedRole) {
				Object.keys(vm.selectedRole).forEach(function(user){
					if (user && (vm.isTeamspaceAdmin(user) || vm.isProjectAdmin(user)) ) {
						vm.selectedRole[user] = "admin";
					}
				});
			}
		};

		$scope.$watch("vm.modelSelected", function(){
			// Find the matching project to the one selected
			vm.modelReady = false;
			vm.resetSelectedModel();
			
			if (vm.teamspaceSelected && vm.projectSelected && vm.modelSelected) {

				vm.selectedModel = vm.models.find(function(model){
					return model.model ===  vm.modelSelected;
				});

				return $q(function(resolve, reject) {

					var endpoint = vm.selectedTeamspace.account + "/" + 
									vm.modelSelected +  "/permissions";

					APIService.get(endpoint)
						.then(function(response){

							var users = response.data;

							// Add the teamspace admin if they don't appear in the list
							if (vm.selectedTeamspace.account === vm.account && users.length === 0) {
								users.push({
									permissions: ["admin"],
									user : vm.account
								});
							}
							
							users.forEach(function(user){

								// If its the teamspace then we can disable 
								// and assign admin role
								if (user.user === vm.account ||(vm.isTeamspaceAdmin(user) || vm.isProjectAdmin(user)) ) {
									vm.selectedRole[user.user] = "admin";
								} else {
									vm.selectedRole[user.user] = user.permission || "unassigned";
								}
								
							});
							vm.modelReady = true;

	
							resolve();
						})
						.catch(function(error){
							var title = "Issue Retrieving Model Permissions";
							vm.showError(title, error);

							reject(error);
						});	
					
				});		
				
			}
			
		});

		vm.sortModels = function(a, b) {

			if (a.name && b.name) {
				var nameA = a.name.toUpperCase(); // ignore upper and lowercase
				var nameB = b.name.toUpperCase(); // ignore upper and lowercase
				if (nameA < nameB) {
					return -1;
				}
				if (nameA > nameB) {
					return 1;
				}
			}

			// names must be equal
			return 0;
		};

		vm.formatModelName = function(model) {
			return (model.federate === true) ? 
				model.name + " (Federation)" : 
				model.name + " (Model)";
		};

		vm.modelStateChange = function(user, role) {
			
			// We don't want people to be able to set admins
			// as it should come from a higher priority
			var upperAdmin = vm.isTeamspaceAdmin(user) || vm.isProjectAdmin(user);
			if (role === "admin" || upperAdmin) {
				return;
			}

			var permissionsToSend = [];

			var validInput = user && role;
			if (validInput) {
				vm.selectedRole[user] = role;
			}

			for (var roleUser in vm.selectedRole) {
				if (roleUser && vm.selectedRole.hasOwnProperty(roleUser)) {

					var permission = vm.selectedRole[roleUser];
					var notUnassigned = permission !== "unassigned";

					if (notUnassigned) {
						permissionsToSend.push({
							user : roleUser,
							permission : permission
						});

					}

				}
			}

			// TODO: Check if the model is a federation and if so, check that they have some 
			// permission on all submodel
	
			var permissionlessModels = [];
			
			if (vm.selectedModel.federate && vm.selectedModel.subModels.length > 0) {
				vm.selectedModel.subModels.forEach(function(subModel){
					
					Object.keys(vm.selectedProject.models).forEach(function(modelId){
						var projectModel = vm.selectedProject.models[modelId];

						if (
							subModel.model === projectModel.model
						) {
							permissionlessModels.push(projectModel);
						}

					});
				});
			}

			if (permissionlessModels.length && role !== "unassigned") {

				var content = "Just to let you know, the assigned user will need permissions on submodels also to see them." + 
				"<br><br> These are the models in question: <br><br>";
				permissionlessModels.forEach(function(model, i) {
					content += " <strong>" + model.name + "</strong>";
					if (i !== permissionlessModels.length) {
						content += ",";
					}

					if ((i + 1) % 4 === 0) {
						content += "<br><br>";
					}
				});

				$mdDialog.show( 
					$mdDialog.alert()
						.clickOutsideToClose(true)
						.title("Reminder about Federation Permissions")
						.htmlContent(content)
						.ariaLabel("Reminder about Federations")
						.ok("OK")
				);
			}

			// Update the permissions user for the selected teamspace
			var endpoint = vm.selectedTeamspace.account + "/" 
							+ vm.modelSelected + "/permissions";
		
			APIService.post(endpoint, permissionsToSend)
				.catch(function(error) {
					var title = "Model Permission Assignment Error";
					vm.showError(title, error);
				});

		};

		vm.showError = function(title, error) {

			if (error && error.data) {
				// Error for developer
				console.error("Error", error);

				// Error for user
				var conf = "Something went wrong: " + 
				"<br><br> <code>Error - " + error.data.message + " (Status Code: " + error.status + ")" + 
				"</code> <br><br> <md-container>";
				$mdDialog.show(
					$mdDialog.alert()
						.clickOutsideToClose(true)
						.title(title)
						.htmlContent(conf)
						.ariaLabel(title)
						.ok("OK")
				);
			} else {
				console.error("Error, but no error response: ", error);
			}
			
		};


	}
}());
