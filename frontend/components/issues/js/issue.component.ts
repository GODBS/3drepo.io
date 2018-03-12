/**
 *	Copyright (C) 2016 3D Repo Ltd
 *
 *	This program is free software: you can redistribute it and/or modify
 *	it under the issueComp of the GNU Affero General Public License as
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

class IssueController implements ng.IController {

	public static $inject: string[] = [
		"$location",
		"$q",
		"$mdDialog",
		"$element",
		"$state",
		"$timeout",
		"$scope",

		"IssuesService",
		"APIService",
		"NotificationService",
		"AuthService",
		"ClientConfigService",
		"AnalyticService",
		"StateManager",
		"MeasureService",
		"ViewerService",
		"TreeService",
		"DialogService",
	];

	private canEditDescription: boolean;
	private issueFailedToLoad: boolean;
	private savedScreenShot: any;
	private editingCommentIndex: any;
	private commentViewpoint: any;
	private aboutToBeDestroyed: boolean;
	private savedDescription;
	private savedComment;
	private reasonCommentText: string;
	private reasonTitleText: string;
	private disabledReason: string;
	private issueProgressInfo: string;
	private textInputHasFocusFlag: boolean;
	private submitDisabled: boolean;
	private pinDisabled: boolean;
	private showAdditional: boolean;
	private editingDescription: boolean;
	private clearPin: boolean;
	private priorities: any[];
	private statuses: any;
	private actions: any;
	private notificationStarted = false;
	private popStateHandler;
	private refreshHandler;
	private data;
	private pinHidden;
	private account;
	private model;
	private comment;
	private issueData;
	private modelSettings;
	private topic_types;
	private modelJobs;
	private availableJobs;
	private userJob;
	private saving;
	private screenShot;
	private revision;
	private issueComponent;
	private commentThumbnail;
	private contentHeight;

	constructor(
		private $location,
		private $q,
		private $mdDialog,
		private $element,
		private $state,
		private $timeout,
		private $scope,

		private IssuesService,
		private APIService,
		private NotificationService,
		private AuthService,
		private ClientConfigService,
		private AnalyticService,
		private StateManager,
		private MeasureService,
		private ViewerService,
		private TreeService,
		private DialogService,
	) {}

	public $onInit() {

		this.canEditDescription = false;
		this.issueFailedToLoad = false;

		this.savedScreenShot = null;
		this.editingCommentIndex = null;
		this.aboutToBeDestroyed = false;

		this.reasonCommentText = "Comment requires text";
		this.reasonTitleText = "Issue requires name";
		this.disabledReason = "";

		this.issueProgressInfo = "Loading Issue...";
		this.textInputHasFocusFlag = false;
		this.submitDisabled = true;
		this.pinDisabled = true;

		this.showAdditional = true;
		this.editingDescription = false;
		this.clearPin = false;

		this.priorities = [
			{value: "none", label: "None"},
			{value: "low", label: "Low"},
			{value: "medium", label: "Medium"},
			{value: "high", label: "High"},
		];
		this.statuses = [
			{value: "open", label: "Open"},
			{value: "in progress", label: "In progress"},
			{value: "for approval", label: "For approval"},
			{value: "closed", label: "Closed"},
		];

		this.actions = {
			screen_shot: {
				id: "screenshot",
				icon: "camera_alt",
				label: "Screen shot",
				disabled: () => {
					if (!this.data) {
						return this.submitDisabled;
					} else {
						return !this.canComment();
					}
				},
				visible: () => {
					return true;
				},
				selected: false,
			},
			pin: {
				id: "pin",
				icon: "place",
				label: "Pin",
				disabled: () => {
					return this.submitDisabled || this.pinHidden;
				},
				visible: () => {
					return !this.data;
				},
				selected: false,
			},
		};

		this.notificationStarted = false;

		this.setContentHeight();
		history.pushState(null, null, document.URL);

		this.popStateHandler = (event) => {
			this.StateManager.popStateHandler(event, this.account, this.model);
		};

		this.refreshHandler = (event) => {
			return this.StateManager.refreshHandler(event);
		};

		// listen for user clicking the back button
		window.addEventListener("popstate", this.popStateHandler);
		window.addEventListener("beforeunload", this.refreshHandler);
		
		this.watchers();
	}

	/**
	 * Save a comment if one was being typed before closegh
	 * Cancel editing comment
	 */
	public $onDestroy() {

		window.removeEventListener("popstate", this.popStateHandler);
		window.removeEventListener("beforeunload", this.refreshHandler);

		this.ViewerService.removeUnsavedPin();

		this.aboutToBeDestroyed = true;
		if (this.comment) {
			this.IssuesService.updateIssues(this.issueData); // So that issues list is notified
			this.saveComment();
		}
		if (this.editingCommentIndex !== null) {
			this.issueData.comments[this.editingCommentIndex].editing = false;
		}
		// Get out of pin drop mode

		this.ViewerService.pin.pinDropMode = false;
		this.MeasureService.setDisabled(false);
		this.clearPin = true;

		// unsubscribe on destroy
		if (this.data) {
			this.NotificationService.unsubscribe.newComment(this.data.account, this.data.model, this.data._id);
			this.NotificationService.unsubscribe.commentChanged(this.data.account, this.data.model, this.data._id);
			this.NotificationService.unsubscribe.commentDeleted(this.data.account, this.data.model, this.data._id);
			this.NotificationService.unsubscribe.issueChanged(this.data.account, this.data.model, this.data._id);
		}

	}

	public watchers() {

		// This keeps the colours updated etc
		this.$scope.$watch("vm.issueData", () => {
			// if (this.issueData) {
			// 	IssuesService.populateIssue(this.issueData);
			// }
		}, true);

		this.$scope.$watch("vm.modelSettings", () => {
			if (this.modelSettings) {
				this.topic_types = this.modelSettings.properties && this.modelSettings.properties.topicTypes || [];
				this.checkCanComment();
				this.convertCommentTopicType();
			}
		});

		this.$scope.$watch("vm.availableJobs", () => {
			// Role
			if (this.availableJobs) {
				this.modelJobs = this.availableJobs.map((availableJob) => {
					/*
					// Get the actual role and return the last part of it
					return availableRole.role.substring(availableRole.role.lastIndexOf(".") + 1);
					*/
					return availableJob._id;
				});

				// Always have an unassign option for users
				this.modelJobs.push("Unassigned");
			}
		});

		this.$scope.$watch("vm.data", () => {

			// Data
			if (this.data && this.statuses && this.statuses.length) {
				this.issueFailedToLoad = false;
				this.issueData = null;

				this.IssuesService.getIssue(this.data.account, this.data.model, this.data._id)
					.then((fetchedIssue) => {
						this.setEditIssueData(fetchedIssue);
						this.startNotification();
						this.issueFailedToLoad = false;
					})
					.catch((error) => {
						this.issueFailedToLoad = true;
						console.error(error);
					});

			} else {
				const creatorRole = this.userJob._id;
				this.issueData = this.IssuesService.createBlankIssue(creatorRole);
				this.IssuesService.populateIssue(this.issueData);
				this.setContentHeight();

			}

		});

	}

	public createStatusLabel(status) {
		status.charAt(0).toUpperCase() + status.slice(1);
	}

	public handleBCFPriority(BCFPriority: string) {

		const exists = this.priorities.find((priority) => {
			return BCFPriority === priority.value;
		});

		if (!exists) {
			const newPriority = {
				value: BCFPriority,
				label: BCFPriority,
			};
			this.priorities.push(newPriority);
			this.$timeout(() => {});

		}

	}

	public handleBCFStatus(BCFStatus: string) {

		const exists = this.statuses.find((status) => {
			return BCFStatus === status.value;
		});

		if (!exists) {
			const newStatus = {
				value: BCFStatus,
				label: BCFStatus,
			};
			// console.log(newStatus);
			this.statuses.push(newStatus);
			this.$timeout(() => {});

		}

	}

	public handleBCFAssign(BCFAssign: string) {

		const exists = this.modelJobs.find((assign) => {
			return BCFAssign === assign.value;
		});

		if (!exists) {
			const newAssign = {
				value: BCFAssign,
				label: BCFAssign,
			};
			this.modelJobs.push(newAssign);
			this.$timeout(() => {});

		}

	}

	public handleBCFType(BCFType: string) {

		const exists = this.topic_types.find((type) => {
			return BCFType === type.value;
		});

		if (!exists) {
			const newType = {
				value: BCFType,
				label: BCFType,
			};
			this.topic_types.push(newType);
			this.$timeout(() => {});

		}

	}

	public getPlaceholderText() {
		if (this.canComment()) {
			return "Write a new comment";
		} else if (this.issueData.status === "closed") {
			return "You cannot comment on a closed issue";
		} else {
			return "You do not have permission to leave comments";
		}
	}

	public convertCommentTopicType() {
		if (this.issueData && this.issueData.comments) {
			this.issueData.comments.forEach((comment) => {
				if (comment.action && comment.action.property === "topic_type") {
					this.IssuesService.convertActionCommentToText(comment, this.topic_types);
				}
			});
		}
	}

	public setEditIssueData(newIssueData) {

		this.issueData = newIssueData;

		this.issueData.comments = this.issueData.comments || [];

		if (!this.issueData.name) {
			this.disabledReason = this.reasonTitleText;
		}

		this.issueData.thumbnailPath = this.APIService.getAPIUrl(this.issueData.thumbnail);
		this.issueData.comments.forEach((comment) => {
			if (comment.owner !== this.AuthService.getUsername()) {
				comment.sealed = true;
			}
		});

		// Old issues
		this.issueData.priority = (!this.issueData.priority) ? "none" : this.issueData.priority;
		this.issueData.status = (!this.issueData.status) ? "open" : this.issueData.status;
		this.issueData.topic_type = (!this.issueData.topic_type) ? "for_information" : this.issueData.topic_type;
		this.issueData.assigned_roles = (!this.issueData.assigned_roles) ? [] : this.issueData.assigned_roles;

		this.checkCanComment();
		this.convertCommentTopicType();

		// Can edit description if no comments
		this.canEditDescription = this.checkCanEditDesc();

		this.IssuesService.populateIssue(this.issueData);
		this.setContentHeight();

	}

	public checkCanEditDesc() {
		// Comments that aren't notifciations
		const canEditDesc = this.IssuesService.canChangeStatusToClosed(
			this.issueData,
			this.userJob,
			this.modelSettings.permissions,
		);

		if (!canEditDesc) {
			return false;
		}

		if (!this.issueData || !this.issueData.comments) {
			return false;
		}

		const comments = this.issueData.comments.filter((comment) => {
			return comment.action === undefined;
		});
		return comments.length === 0;
	}

	public nameChange() {

		this.submitDisabled = !this.issueData.name;
		if (!this.submitDisabled) {
			this.disabledReason = this.reasonTitleText;
		}

	}

	/**
	 * Disable the save button when commenting on an issue if there is no comment
	 */
	public commentChange() {
		this.submitDisabled = (this.data && !this.comment);
		if (!this.submitDisabled) {
			this.disabledReason = this.reasonCommentText;
		}
	}

	public checkCanComment() {

		return this.IssuesService.canComment(
			this.issueData,
			this.userJob,
			this.modelSettings.permissions,
		);

	}

	public canChangePriority() {

		if (!this.IssuesService.isOpen(this.issueData)) {
			return false;
		}

		return this.IssuesService.canChangePriority(
			this.issueData,
			this.userJob,
			this.modelSettings.permissions,
		);

	}

	public disableStatusOption(status) {

		if (status.value === "closed" || status.value === "open") {
			return !this.IssuesService.canChangeStatusToClosed(
				this.issueData,
				this.userJob,
				this.modelSettings.permissions,
			);
		}

		return false;

	}

	public canChangeStatus() {

		// We don't check is open because we need to be
		// able to open the issue!

		return this.IssuesService.canChangeStatus(
			this.issueData,
			this.userJob,
			this.modelSettings.permissions,
		);

	}

	public canChangeType() {

		if (!this.IssuesService.isOpen(this.issueData)) {
			return false;
		}

		return this.IssuesService.canChangeType(
			this.issueData,
			this.userJob,
			this.modelSettings.permissions,
		);

	}

	public canChangeDueDate() {

		if (!this.IssuesService.isOpen(this.issueData)) {
			return false;
		}

		return this.IssuesService.canChangeDueDate(
			this.issueData,
			this.userJob,
			this.modelSettings.permissions,
		);

	}

	public canChangeAssigned() {

		if (!this.IssuesService.isOpen(this.issueData)) {
			return false;
		}

		return this.IssuesService.canChangeAssigned(
			this.issueData,
			this.userJob,
			this.modelSettings.permissions,
		);

	}

	public canComment() {

		if (!this.IssuesService.isOpen(this.issueData)) {
			return false;
		}

		return this.IssuesService.canComment(
			this.issueData,
			this.userJob,
			this.modelSettings.permissions,
		);

	}

	/**
	 * Handle status change
	 */
	public statusChange() {

		if (this.data && this.issueData.account && this.issueData.model) {

			// If it's unassigned we can update so that there are no assigned roles
			if (this.issueData.assigned_roles.indexOf("Unassigned") !== -1) {
				this.issueData.assigned_roles = [];
			}

			const statusChangeData = {
				priority: this.issueData.priority,
				status: this.issueData.status,
				topic_type: this.issueData.topic_type,
				due_date: this.issueData.due_date,
				assigned_roles: this.issueData.assigned_roles,
			};

			this.IssuesService.updateIssue(this.issueData, statusChangeData)
				.then((response) => {
					if (response) {
						const respData = response.data.issue;
						this.IssuesService.populateIssue(respData);
						this.issueData = respData;

						// Add info for new comment
						this.issueData.comments.forEach((comment) => {
							if (comment && comment.action && comment.action.property) {
								this.IssuesService.convertActionCommentToText(comment, this.topic_types);
							}
							if (comment && comment.created) {
								comment.timeStamp = this.IssuesService.getPrettyTime(comment.created);
							}
						});

						// Update last but one comment in case it was "sealed"
						if (this.issueData.comments.length > 1) {
							this.issueData.comments[this.issueData.comments.length - 2].sealed = true;
						}

						// Update the actual data model
						this.IssuesService.updateIssues(this.issueData);

						this.commentAreaScrollToBottom();
					}

				})
				.catch(this.handleUpdateError.bind(this));

			this.checkCanComment();

			this.AnalyticService.sendEvent({
				eventCategory: "Issue",
				eventAction: "edit",
			});
		}
	}

	public handleUpdateError(error) {
		const content = "We tried to update your issue but it failed. " +
		"If this continues please message support@3drepo.io.";
		const escapable = true;
		console.error(error);
		this.DialogService.text("Error Updating Issue", content, escapable);
	}

	public getCommentPlaceholderText() {
		if (this.canComment()) {
			return "Write your comment here";
		} else {
			return "You are not able to comment";
		}
	}

	/**
	 * Submit - new issue or comment or update issue
	 */
	public submit() {

		this.saving = true;

		if (this.data) {
			this.saveComment();
		} else {
			this.saveIssue();
		}

	}

	/**
	 * Show viewpoint
	 * @param event
	 * @param viewpoint Can be undefined for action comments
	 */
	public showViewpoint(event, viewpoint) {

		// README: vm should also highlight selected objects within vm issue, but
		// will require a lot of rewriting for vm to work at present!
		if (viewpoint && (event.type === "click")) {

			// We clone the issueData so that we don't
			// overwrite the original issue data itself
			const newViewpointData = angular.copy(this.issueData);
			newViewpointData.viewpoint = viewpoint;
			this.IssuesService.showIssue(newViewpointData);

		}
	}

	/**
	 * Show screen shot
	 * @param event
	 * @param viewpoint
	 */
	public showScreenShot(event, viewpoint) {
		if (viewpoint.screenshot) {

			// We have a saved screenshot we use that
			this.screenShot = this.APIService.getAPIUrl(viewpoint.screenshot);
			this.showScreenshotDialog(event);
		} else if (this.issueData.descriptionThumbnail) {

			// We haven't saved yet we can use the thumbnail
			this.screenShot = this.issueData.descriptionThumbnail;
			this.showScreenshotDialog(event);
		}
	}

	/**
	 * Show screen shot dialog
	 * @param event
	 */
	public showScreenshotDialog(event) {
		this.$mdDialog.show({
			controller: () => {
				this.issueComponent = this;
			},
			controllerAs: "vm",
			templateUrl: "templates/issue-screen-shot-dialog.html",
			targetEvent: event,
		});
	}

	/**
	 * Do an action
	 * @param event
	 * @param action
	 */
	public doAction(event, action) {
		// Handle previous action
		this.actions[action].selected = !this.actions[action].selected;
		const selected = this.actions[action].selected;

		switch (action) {
		case "pin":

			if (selected) {
				this.ViewerService.pin.pinDropMode = true;
				this.MeasureService.deactivateMeasure();
				this.MeasureService.setDisabled(true);
			} else {
				this.ViewerService.pin.pinDropMode = false;
				this.MeasureService.setDisabled(false);
			}
			break;

		case "screen_shot":

			// There is no concept of selected in screenshot as there will be a popup once you click the button
			this.actions[action].selected = false;

			delete this.screenShot; // Remove any clicked on screen shot
			this.showScreenshotDialog(event);
			break;

		}

	}

	/**
	 * Toggle showing of extra inputs
	 */
	public toggleShowAdditional() {

		if (!this.textInputHasFocusFlag) {
			// don't toggle if the user is trying to type
			this.showAdditional = !this.showAdditional;
			this.setContentHeight();
		}

	}

	/**
	 * Edit or save description
	 * @param event
	 */
	public toggleEditDescription(event) {
		event.stopPropagation();
		if (this.editingDescription) {
			this.editingDescription = false;

			if (this.issueData.desc !== this.savedDescription) {
				const data = {
					desc: this.issueData.desc,
				};
				this.IssuesService.updateIssue(this.issueData, data)
					.then((issueData) => {

						if (issueData) {
							this.IssuesService.updateIssues(this.issueData);
							this.savedDescription = this.issueData.desc;
						} else {
							this.handleUpdateError(issueData);
						}

					})
					.catch(this.handleUpdateError.bind(this));
			}

		} else {
			this.editingDescription = true;
			this.savedDescription = this.issueData.desc;
		}
	}

	/**
	 * Register if text input has focus or not
	 * @param focus
	 */
	public textInputHasFocus(focus) {
		this.textInputHasFocusFlag = focus;
	}

	/**
	 * This prevents show/hide of additional info when clicking in the input
	 * @param event
	 */
	public titleInputClick(event) {
		event.stopPropagation();
	}

	/**
	 * Save issue
	 */
	public saveIssue() {

		const viewpointPromise = this.$q.defer();
		const screenShotPromise = this.$q.defer();
		const objectsPromise = this.$q.defer();

		if (this.commentViewpoint) {
			viewpointPromise.resolve(this.commentViewpoint);
		} else {
			// Get the viewpoint
			this.ViewerService.getCurrentViewpoint(
				{promise: viewpointPromise, account: this.account, model: this.model},
			);
		}

		// Get selected objects
		this.ViewerService.getObjectsStatus({
			promise: objectsPromise,
		});

		viewpointPromise.promise
			.then((viewpoint) => {
				objectsPromise.promise
					.then((objectInfo) => {
						viewpoint.hideIfc = this.TreeService.getHideIfc();
						this.handleObjects(viewpoint, objectInfo, screenShotPromise);
					})
					.catch((error) => {
						console.error(error);
					});
			})
			.catch((error) => {
				console.error(error);
			});

	}

	public handleObjects(viewpoint, objectInfo, screenShotPromise) {

		// TODO - clean up repeated code below
		if (this.savedScreenShot !== null) {

			if (objectInfo.highlightedNodes.length > 0 || objectInfo.hiddenNodes.length > 0) {
				// Create a group of selected objects
				this.createGroup(viewpoint, this.savedScreenShot, objectInfo);
			} else {
				this.doSaveIssue(viewpoint, this.savedScreenShot);
			}

		} else {
			// Get a screen shot if not already created
			this.ViewerService.getScreenshot(screenShotPromise);

			screenShotPromise.promise
				.then((screenShot) => {
					if (objectInfo.highlightedNodes.length > 0 || objectInfo.hiddenNodes.length > 0) {
						this.createGroup(viewpoint, screenShot, objectInfo);
					} else {
						this.doSaveIssue(viewpoint, screenShot);
					}
				})
				.catch((error) => {
					console.error(error);
				});

		}

	}

	/**
	 * Prune node from group if its parent is already a part of the group.
	 * @returns prunedNodes	List of nodes with children pruned out.
	 */
	public pruneNodes(nodes, property) {
		let prunedNodes = [];

		if (property) {
			const prunedNodesMap = [];
			for (let i = 0; i < nodes.length; i++) {
				let nodePath = this.TreeService.getPath(nodes[i].id);
				const node = this.TreeService.getNodeById(nodes[i].id);
				while (nodePath && nodePath.length > 0) {
					const parentNodeId = nodePath.shift();
					const parentNode = this.TreeService.getNodeById(parentNodeId);
					if (
						(node[property] && node[property] === parentNode[property]) ||
						(!node[property] && 1 === nodePath.length)
					) {
						prunedNodesMap[parentNode._id] = {
							account: parentNode.account,
							id: parentNode._id,
							model: parentNode.project,
							shared_id: parentNode.shared_id,
						};
						nodePath = undefined;
					}
				}
			}

			for (const nodeId in prunedNodesMap) {
				if (nodeId) {
					prunedNodes.push(prunedNodesMap[nodeId]);
				}
			}

		} else {
			console.error("pruneNodes - arg. property (\"toggleState\" | \"selected\") undefined! Returning nodes.");
			prunedNodes = nodes;
		}

		return prunedNodes;
	}

	/**
	 * @returns groupData	Object with list of nodes for group creation.
	 */
	public createGroupData(nodes) {
		const groupData = {
			name: this.issueData.name,
			color: [255, 0, 0],
			objects: nodes,
		};
		return groupData;
	}

	public createGroup(viewpoint, screenShot, objectInfo) {

		// Create a group of selected objects
		const highlightedGroupData = this.createGroupData(this.pruneNodes(objectInfo.highlightedNodes, "selected"));

		// Create a group of hidden objects
		const hiddenGroupData = this.createGroupData(this.pruneNodes(objectInfo.hiddenNodes, "toggleState"));

		this.APIService.post(`${this.account}/${this.model}/groups`, highlightedGroupData)
			.then((highlightedGroupResponse) => {

				viewpoint.highlighted_group_id = highlightedGroupResponse.data._id;
				this.APIService.post(`${this.account}/${this.model}/groups`, hiddenGroupData)
					.then((hiddenGroupResponse) => {
						viewpoint.hidden_group_id = hiddenGroupResponse.data._id;
						this.doSaveIssue(viewpoint, screenShot);
					}).catch((error) => {
						console.error(error);
					});

			}).catch((error) => {
				console.error(error);
			});

	}

	/**
	 * Send new issue data to server
	 * @param viewpoint
	 * @param screenShot
	 */
	public doSaveIssue(viewpoint, screenShot) {

		// Remove base64 header text from screenShot and add to viewpoint
		screenShot = screenShot.substring(screenShot.indexOf(",") + 1);
		viewpoint.screenshot = screenShot;

		// Save issue
		const issue = {
			account: this.account,
			model: this.model,
			objectId: null,
			name: this.issueData.name,
			viewpoint,
			creator_role: this.userJob._id,
			pickedPos: null,
			pickedNorm: null,
			scale: 1.0,
			assigned_roles: this.issueData.assigned_roles,
			priority: this.issueData.priority,
			status: this.issueData.status,
			topic_type: this.issueData.topic_type,
			due_date: this.issueData.due_date,
			desc: this.issueData.desc,
			rev_id: this.revision,
		};

		// Pin data
		const pinData = this.ViewerService.getPinData();
		if (pinData !== null) {
			issue.pickedPos = pinData.pickedPos;
			issue.pickedNorm = pinData.pickedNorm;
		}

		this.IssuesService.saveIssue(issue)
			.then((response) => {
				this.data = response.data; // So that new changes are registered as updates
				const responseIssue = response.data;

				// Hide the description input if no description
				this.pinHidden = true;

				// Notify parent of new issue
				this.IssuesService.populateIssue(responseIssue);
				this.issueData = responseIssue;
				this.IssuesService.addIssue(this.issueData);
				this.IssuesService.setSelectedIssue(this.issueData, true);

				// Hide some actions
				this.ViewerService.pin.pinDropMode = false;

				this.submitDisabled = true;
				this.setContentHeight();

				this.startNotification();
				this.saving = false;

				const issueState = {
					account: this.account,
					model: this.model,
					revision: this.revision,
					issue: this.data._id,
					noSet: true,
				};

				this.disabledReason = this.reasonCommentText;

				this.$state.go(
					"home.account.model.issue",
					issueState,
					{notify: false},
				);

			})
			.catch((error) => {
				const content = "Something went wrong saving the issue. " +
				"If this continues please message support@3drepo.io.";
				const escapable = true;

				this.DialogService.text("Error Saving Issue", content, escapable);
				console.error("Something went wrong saving the Issue: ", error);
			});

		this.AnalyticService.sendEvent({
			eventCategory: "Issue",
			eventAction: "create",
		});
	}

	public saveComment() {
		const viewpointPromise = this.$q.defer();
		const objectsPromise = this.$q.defer();

		// Get selected objects
		this.ViewerService.getObjectsStatus({
			promise: objectsPromise,
		});

		objectsPromise.promise.then((objectInfo) => {

			// Create a group of selected objects
			const prunedSelected = this.pruneNodes(objectInfo.highlightedNodes, "selected");
			const highlightedGroupData = this.createGroupData(prunedSelected);

			// Create a group of hidden objects
			const pruneHidden = this.pruneNodes(objectInfo.hiddenNodes, "toggleState");
			const hiddenGroupData = this.createGroupData(pruneHidden);


			// TODO: This needs denesting
			const postUrl = `${this.account}/${this.model}/groups`;
			this.APIService.post(postUrl, highlightedGroupData)
				.then((highlightedGroupResponse) => {
					this.APIService.post(postUrl, hiddenGroupData)
						.then((hiddenGroupResponse) => {
							if (angular.isDefined(this.commentThumbnail)) {
								this.commentViewpoint.highlighted_group_id = highlightedGroupResponse.data._id;
								this.commentViewpoint.hidden_group_id = hiddenGroupResponse.data._id;
								this.commentViewpoint.hideIfc = this.TreeService.getHideIfc();
								this.IssuesService.saveComment(this.issueData, this.comment, this.commentViewpoint)
									.then((response) => {
										this.saving = false;
										this.canEditDescription = this.checkCanEditDesc();
										this.afterNewComment(response.data.issue, false);
									})
									.catch((error) => {
										this.errorSavingComment(error);
									});

							} else {

								this.ViewerService.getCurrentViewpoint(
									{promise: viewpointPromise, account: this.issueData.account, model: this.issueData.model}
								);

								viewpointPromise.promise.then((viewpoint) => {
									viewpoint.highlighted_group_id = highlightedGroupResponse.data._id;
									viewpoint.hidden_group_id = hiddenGroupResponse.data._id;
									viewpoint.hideIfc = this.TreeService.getHideIfc();
									this.IssuesService.saveComment(this.issueData, this.comment, viewpoint)
										.then((response) => {
											this.saving = false;
											this.afterNewComment(response.data.issue, false);
										})
										.catch((error) => {
											this.errorSavingComment(error);
										});
								})
								.catch((error) => {
									console.error(error);
								});
							}
						})
						.catch((error) => {
							console.error(error);
						});
				})
				.catch((error) => {
					console.error(error);
				});

			this.AnalyticService.sendEvent({
				eventCategory: "Issue",
				eventAction: "comment",
			});
		});
	}

	public errorSavingComment(error) {
		const content = "Something went wrong saving the comment. " +
		"If this continues please message support@3drepo.io.";
		const escapable = true;
		this.DialogService.text("Error Saving Comment", content, escapable);
		console.error("Something went wrong saving the issue comment: ", error);
	};

	public errorDeleteComment(error) {
		const content = "Something went wrong deleting the comment. " +
		"If this continues please message support@3drepo.io.";
		const escapable = true;
		this.DialogService.text("Error Deleting Comment", content, escapable);
		console.error("Something went wrong deleting the issue comment: ", error);
	};

	public errorSavingScreemshot(error) {
		const content = "Something went wrong saving the screenshot. " +
		"If this continues please message support@3drepo.io.";
		const escapable = true;
		
		this.DialogService.text("Error Saving Screenshot", content, escapable);
		console.error("Something went wrong saving the screenshot: ", error);
	};


	/**
	 * Process after new comment saved
	 * @param comment
	 */
	public afterNewComment(comment, noDeleteInput) {

		// mark all other comments sealed
		this.issueData.comments.forEach((otherComment) => {
			otherComment.sealed = true;
		});

		if(comment.owner !== this.AuthService.getUsername()) {
			comment.sealed = true;
		}

		if(comment.viewpoint && comment.viewpoint.screenshot){
			comment.viewpoint.screenshotPath = this.APIService.getAPIUrl(comment.viewpoint.screenshot);
		}

		// Add new comment to issue
		if (!this.issueData.comments) {
			this.issueData.comments = [];
		}
		this.issueData.comments.push({
			sealed: comment.sealed,
			guid: comment.guid,
			comment: comment.comment,
			owner: comment.owner,
			timeStamp: this.IssuesService.getPrettyTime(comment.created),
			viewpoint: comment.viewpoint,
			action: comment.action
		});

		if(!noDeleteInput) {
			delete this.comment;
			delete this.commentThumbnail;
			this.IssuesService.updateIssues(this.issueData);
			this.submitDisabled = true;
		}

		this.commentAreaScrollToBottom();
		// Don't set height of content if about to be destroyed as it overrides the height set by the issues list
		if (!this.aboutToBeDestroyed) {
			this.setContentHeight();
		}
	};

	/**
	 * Delete a comment
	 * @param event
	 * @param index
	 */
	public deleteComment(event, index) {
		event.stopPropagation();
		const commentIndex = (this.issueData.comments.length - 1) - index;

		this.IssuesService.deleteComment(this.issueData, commentIndex)
			.then(() => {
				this.issueData.comments.splice(commentIndex, 1);
			})
			.catch((error) => {
				this.errorDeleteComment(error);
			});

		this.AnalyticService.sendEvent({
			eventCategory: "Issue",
			eventAction: "deleteComment"
		});

		this.setContentHeight();
	};
	
	/**
	 * A screen shot has been saved
	 * @param data
	 */
	public screenShotSave(data) {
		let viewpointPromise = this.$q.defer();

		this.savedScreenShot = data.screenShot;

		if (typeof this.data === "object") {

			// Comment
			this.commentThumbnail = data.screenShot;

			// Get the viewpoint and add the screen shot to it
			// Remove base64 header text from screen shot
			this.ViewerService.getCurrentViewpoint(
				{promise: viewpointPromise, account: this.issueData.account, model: this.issueData.model}
			);

		} else {
			// Description
			this.issueData.descriptionThumbnail = data.screenShot;

			this.ViewerService.getCurrentViewpoint(
				{promise: viewpointPromise, account: this.account, model: this.model}
			);
		}

		viewpointPromise.promise
			.then((viewpoint) => {
				this.commentViewpoint = viewpoint;
				this.commentViewpoint.screenshot = data.screenShot.substring(data.screenShot.indexOf(",") + 1);
			}).catch((error) => {
				this.errorSavingScreemshot(error);
			});

		this.setContentHeight();
	};

	/**
	 * Set the content height
	 */
	public setContentHeight() {
		let i, length,
			newIssueHeight = 305,
			descriptionTextHeight = 80,
			commentTextHeight = 80,
			commentImageHeight = 170,
			additionalInfoHeight = 160,
			thumbnailHeight = 180,
			issueMinHeight = 370,
			height = issueMinHeight;

		if (this.data) {

			// Additional info
			if (this.showAdditional) {
				height += additionalInfoHeight;
			}
			// Description text
			if (this.canEditDescription || (this.issueData && this.issueData.hasOwnProperty("desc")) ) {
				height += descriptionTextHeight;
			}
			// Description thumbnail
			height += thumbnailHeight;
			// New comment thumbnail
			if (this.commentThumbnail) {
				height += thumbnailHeight;
			}
			// Comments
			if (this.issueData && this.issueData.comments) {
				for (i = 0, length = this.issueData.comments.length; i < length; i += 1) {
					height += commentTextHeight;
					if (this.issueData.comments[i].viewpoint && this.issueData.comments[i].viewpoint.hasOwnProperty("screenshot")) {
						height += commentImageHeight;
					}
				}
			}

		} else {
			height = newIssueHeight;
			if (this.showAdditional) {
				height += additionalInfoHeight;
			}
			// Description thumbnail
			if (this.issueData && this.issueData.descriptionThumbnail) {
				height += thumbnailHeight;
			}
		}

		if (height) {
			this.contentHeight({height});
		} else {
			console.error("Height was trying to be set to falsy value");
		}

	};

	public commentAreaScrollToBottom() {

		this.$timeout(() => {
			const commentArea = document.getElementById("descriptionAndComments");
			if (commentArea) {
				commentArea.scrollTop = commentArea.scrollHeight;
			}
		});
	};

	public handleIssueChange(issue) {

		this.IssuesService.populateIssue(issue);
		this.issueData = issue;

		this.$scope.$apply();

	};

	public startNotification() {

		if (this.data && !this.notificationStarted) {

			this.notificationStarted = true;

			/*
			* Watch for issue change
			*/

			this.NotificationService.subscribe.issueChanged(
				this.data.account,
				this.data.model,
				this.data._id,
				this.handleIssueChange,
			);

			/*
			* Watch for new comments
			*/
			this.NotificationService.subscribe.newComment(this.data.account, this.data.model, this.data._id, (comment) => {

				if (comment.action) {
					this.IssuesService.convertActionCommentToText(comment, this.topic_types);
				}

				this.afterNewComment(comment, true);

				// necessary to apply scope.apply and reapply scroll down again here because vm function is not triggered from UI
				this.$scope.$apply();
				this.commentAreaScrollToBottom();
			});

			/*
			* Watch for comment changed
			*/
			this.NotificationService.subscribe.commentChanged(this.data.account, this.data.model, this.data._id, (newComment) => {

				const comment = this.issueData.comments.find((oldComment) => {
					return oldComment.guid === newComment.guid;
				});

				comment.comment = newComment.comment;

				this.$scope.$apply();
				this.commentAreaScrollToBottom();
			});

			/*
			* Watch for comment deleted
			*/
			this.NotificationService.subscribe.commentDeleted(this.data.account, this.data.model, this.data._id, (newComment) => {

				let deleteIndex;
				this.issueData.comments.forEach((comment, i) => {
					if (comment.guid === newComment.guid) {
						deleteIndex = i;
					}
				});

				this.issueData.comments[deleteIndex].comment = "This comment has been deleted.";

				this.$scope.$apply();
				this.commentAreaScrollToBottom();

				this.$timeout(() => {
					this.issueData.comments.splice(deleteIndex, 1);
				}, 4000);
			});

		}
};

}

export const IssueComponent: ng.IComponentOptions = {
	bindings: {
		account: "<",
		model: "<",
		revision: "<",
		data: "=",
		keysDown: "<",
		exit: "&",
		event: "<",
		selectedIssueLoaded: "<",
		contentHeight: "&",
		selectedObjects: "<",
		modelSettings: "<",
		setInitialSelectedObjects: "&",
		userJob: "<",
		availableJobs: "<",
	},
	controller: IssueController,
	controllerAs: "vm",
	templateUrl: "templates/issue.html",
};

export const IssueComponentModule = angular
	.module("3drepo")
	.component("issue", IssueComponent);