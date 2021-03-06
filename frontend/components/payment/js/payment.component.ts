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

class PaymentController implements ng.IController {

	public static $inject: string[] = [
		"StateManager"
	];

	constructor(
		private StateManager: any
	) {}

	public $onInit() {}

	public goToLoginPage() {
		this.StateManager.goHome();
	}

}

export const PaymentComponent: ng.IComponentOptions = {
	bindings: {},
	controller: PaymentController,
	controllerAs: "vm",
	templateUrl: "templates/payment.html"
};

export const PaymentComponentModule = angular
	.module("3drepo")
	.component("payment", PaymentComponent);
