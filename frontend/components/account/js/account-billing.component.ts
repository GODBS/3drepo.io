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
class AccountBillingController implements ng.IController {

	public static $inject: string[] = [
		"$scope",
		"$window",
		"$timeout",

		"ClientConfigService",
		"DialogService",
		"APIService"
	];

	private showInfo;
	private saveDisabled;
	private countries;
	private usStates;
	private showStates;
	private newBillingAddress;
	private numLicenses;
	private account;
	private billings;
	private countrySelectDisabled;
	private companyNameRequired;
	private billingAddress;
	private subscriptions;
	private plans;
	private numNewLicenses;
	private payPalInfo;
	private closeDialogEnabled;
	private changeHelpToShow;
	private payPalError;
	private pricePerLicense;
	private priceLicenses;
	private planId;
	private quota;
	private billingError: boolean;

	constructor(
		private $scope: ng.IScope,
		private $window: ng.IWindowService,
		private $timeout: ng.ITimeoutService,

		private ClientConfigService,
		private DialogService,
		private APIService
	) {}

	public $onInit() {
		this.initBillingData();
		this.showInfo = true;
		this.saveDisabled = true;
		this.countries = this.ClientConfigService.countries;
		this.usStates = this.ClientConfigService.usStates;
		this.showStates = false;
		this.newBillingAddress = {};
		this.watchers();
	}

	public initBillingData() {
		const initialisationPromises = [];
		initialisationPromises.push(this.initSubscriptions());
		initialisationPromises.push(this.initBillings());
		initialisationPromises.push(this.initPlans());
		initialisationPromises.push(this.initQuota());

		Promise.all(initialisationPromises)
			.then((results) => {
				this.billingError = false;
			})
			.catch((error) => {
				console.error(error);
			});
	}

	public initBillings() {
		return this.APIService.get(this.account + "/invoices")
			.then((response) => {
				this.billings = response.data;
			})
			.catch(this.handleAPIError.bind(this));
	}

	public initPlans() {
		return this.APIService.get("/plans")
			.then((response) => {
				this.plans = response.data;
			})
			.catch(this.handleAPIError.bind(this));
	}

	public initSubscriptions() {
		return this.APIService.get(this.account + "/subscriptions")
			.then((response) => {
				this.subscriptions = response.data;
			})
			.catch(this.handleAPIError.bind(this));
	}

	public initQuota() {
		return this.APIService.get(this.account + "/quota")
			.then((response) => {
				this.quota = response.data;
			})
			.catch(this.handleAPIError.bind(this));
	}

	public handleAPIError(error) {
		this.billingError = true;
		throw error;
	}

	public watchers() {

		/*
		* Watch for change in licenses
		*/
		this.$scope.$watch("vm.numNewLicenses", () => {

			if (this.isDefined(this.numNewLicenses)) {
				if ((this.numLicenses === 0) && (this.numNewLicenses === 0)) {
					this.saveDisabled = true;
				} else if (this.numLicenses === this.numNewLicenses) {
					this.saveDisabled = angular.equals(this.newBillingAddress, this.billingAddress) ||
										this.aRequiredAddressFieldIsEmpty();
				} else {
					this.saveDisabled = this.aRequiredAddressFieldIsEmpty();
				}
				this.priceLicenses = this.numNewLicenses * this.pricePerLicense;
			} else {
				this.saveDisabled = true;
			}
		});

		/*
			* Watch passed billing address
			*/
		this.$scope.$watch("vm.billingAddress", () => {
			if (this.isDefined(this.billingAddress)) {
				this.newBillingAddress = angular.copy(this.billingAddress);
				// Cannot change country
				this.countrySelectDisabled = this.isDefined(this.billingAddress.countryCode);
			}
		}, true);

		/*
			* Watch for change in billing info
			*/
		this.$scope.$watch("vm.newBillingAddress", () => {
			if (this.isDefined(this.newBillingAddress)) {
				if (this.numNewLicenses !== 0) {
					this.saveDisabled = angular.equals(this.newBillingAddress, this.billingAddress) ||
										this.aRequiredAddressFieldIsEmpty();

					// Company name required if VAT number exists
					this.companyNameRequired = (this.isDefined(this.newBillingAddress.vat) && (this.newBillingAddress.vat !== ""));
				}
				this.showStates = (this.newBillingAddress.countryCode === "US");
			}
		}, true);

		/*
			* Watch for subscriptions
			*/
		this.$scope.$watch("vm.subscriptions", () => {
			if (this.isDefined(this.subscriptions) && this.isDefined(this.plans)) {
				this.setupLicensesInfo();
			}
		}, true);

		/*
			* Watch for plans
			*/
		this.$scope.$watch("vm.plans", () => {
			if (this.isDefined(this.subscriptions) && this.isDefined(this.plans)) {
				this.setupLicensesInfo();
			}
		}, true);

		/*
			* Watch for billings
			*/
		this.$scope.$watch("vm.billings", () => {

			if (this.isDefined(this.billings)) {
				for (let i = 0; i < this.billings.length; i ++) {
					if (this.billings[i].type === "refund") {
						this.billings[i].status = "Completed";
						this.billings[i].description = "Refund";
					} else {
						this.billings[i].status = this.billings[i].pending ? "Pending" : "Paid";
						this.billings[i].description = this.billings[i].items[0].description;
					}
				}
			}

		});

	}

	public isDefined(value) {
		return value !== undefined && value !== null;
	}

	/**
	 * Show the billing page with the item
	 */
	public downloadBilling(index) {
		// $window.open("/billing?user=" + this.account + "&item=" + index);
		const endpoint = this.account + "/invoices/" + this.billings[index].invoiceNo + ".pdf";
		const url = this.ClientConfigService.apiUrl(this.ClientConfigService.GET_API, endpoint);
		this.$window.open(url, "_blank");
	}

	public changeSubscription() {
		const data = {
			plans: [{
				plan: this.planId,
				quantity: this.numNewLicenses
			}],
			billingAddress: this.newBillingAddress
		};

		const licenceCountChanged = this.numLicenses !== this.numNewLicenses;
		if (!licenceCountChanged) {
			this.payPalInfo = "Updating billing information. Please do not refresh the page or close the tab.";
		} else {
			this.payPalInfo = "Redirecting to PayPal. Please do not refresh the page or close the tab.";
		}

		this.DialogService.showDialog("paypal-dialog.html", this.$scope, null, true);

		const payPalError = `Unfortunately something went wrong contacting PayPal.
				Please contact support@3drepo.org if this continues.`;

		this.APIService.post(this.account + "/subscriptions", data)
			.then((response) => {
				if (response.status === 200) {
					if (!licenceCountChanged) {
						this.payPalInfo = "Billing information updated.";
						this.$timeout(() => {
							this.DialogService.closeDialog();
						}, 2000);
					} else {
						location.href = response.data.url;
					}
				} else {
					this.closeDialogEnabled = true;
					this.changeHelpToShow = response.data.value;
					this.payPalError = payPalError;
					this.payPalInfo = "Details: " + response.data.message;
				}
			})
			.catch((error) => {
				this.payPalError = payPalError;
				this.closeDialogEnabled = true;
			});
	}

	public closeDialog() {
		this.DialogService.closeDialog();
	}

	/**
	 * Set up num licenses and price
	 */
	public setupLicensesInfo() {
		this.numLicenses = 0;
		this.pricePerLicense = null;
		if (this.subscriptions.paypal && this.subscriptions.paypal.length > 0) {
			this.numLicenses = this.subscriptions.paypal.reduce((total, item) => {
				return total + item.quantity;
			}, 0);

			this.planId = this.subscriptions.paypal[0].plan;
			if (this.planId && this.plans[this.subscriptions.paypal[0].plan]) {
				this.pricePerLicense = this.plans[this.subscriptions.paypal[0].plan].price;
			}
		}

		if (!this.planId || !this.pricePerLicense) {
			// Use the user's current plan if they already have a plan
			// Otherwise use the first available plan
			const availablePlansIdx = Object.keys(this.plans).filter( (key) => this.plans[key].available);
			this.pricePerLicense = availablePlansIdx.length ? this.plans[availablePlansIdx[0]].price : 0;
			this.planId = availablePlansIdx[0];
		}

		this.numNewLicenses = this.numLicenses;

	}

	/**
	 * Check if any required input fields is empty
	 */
	public aRequiredAddressFieldIsEmpty(): boolean {

		const vat = (this.isDefined(this.newBillingAddress.vat) &&
					(this.newBillingAddress.vat !== "") &&
					!this.isDefined(this.newBillingAddress.company));

		const us = ((this.newBillingAddress.countryCode === "US") &&
					!this.isDefined(this.newBillingAddress.state));

		return (
			!this.isDefined(this.newBillingAddress.firstName) ||
			!this.isDefined(this.newBillingAddress.lastName) ||
			!this.isDefined(this.newBillingAddress.line1) ||
			!this.isDefined(this.newBillingAddress.postalCode) ||
			!this.isDefined(this.newBillingAddress.city) ||
			!this.isDefined(this.newBillingAddress.countryCode) ||
			vat ||
			us
		);
	}

}

export const AccountBillingComponent: ng.IComponentOptions = {
	bindings: {
		account: "=",
		billingAddress: "="
	},
	controller: AccountBillingController,
	controllerAs: "vm",
	templateUrl: "templates/account-billing.html"
};

export const AccountBillingComponentModule = angular
	.module("3drepo")
	.component("accountBilling", AccountBillingComponent);
