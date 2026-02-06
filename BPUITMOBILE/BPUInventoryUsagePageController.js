/*
 * Licensed Materials - Property of IBM
 *
 * 5724-U18, 5737-M66
 *
 * (C) Copyright IBM Corp. 2023 All Rights Reserved
 *
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with
 * IBM Corp.
 */
import { log } from "@maximo/maximo-js-api";
import { v4 as uuidv4 } from "uuid";

import CommonUtil from "./utils/CommonUtil";

const TAG = "InventoryUsagePageController";
const SPLIT_DRAWER = "invUsageLineSplitItem";
const DEL_INVUSELINE_CONFIRM_DIALOG = "sysMsgDialog_invuselinedel";
const INVUSE_SAVEERR_DIALOG = "sysMsgDialog_invuse_saveerr";
const INVUSE_SAVE_VALIDATION_ERR_DIALOG =
  "sysMsgDialog_invuse_saveValidationErr";
const CONFIRM_STAGE_BIN_DIALOG = "sysMsgDialog_confirmStageBin";
const SHIP_REQUIRED_CANSHIP_DIALOG = "sysMsgDialog_shipRequired_canShip";
const SHIP_REQUIRED_CANNOTSHIP_DIALOG = "sysMsgDialog_shipRequired_cannotShip";
const SHIP_NOT_REQUIRED_DIALOG = "sysMsgDialog_shipNotRequired";
const CANNOT_STAGE_DIALOG = "sysMsgDialog_cannotStage";
const QUANTITY_NOT_MATCH = "quantityNotMatch";
const QUANTITYNOTMATCH_MSG =
  "The sum of split quantities should equal to the quantity set in inventory usage line.";
const INVALID_INVUSE_LINES = "invalid_invuse_lines";
const INVALID_INVUSE_LINES_MSG =
  "(Usage lines - {0}) * From the Inventory Usage application, issue the inventory usage record to provide the missing information.";
const INVALIDLOT_DIALOG_TITLE = "invalidlot_dialog_title";
const INVALIDLOT_DIALOG_TITLE_MSG = "Invalid Lot";
const INVALID_LOT = "lotValueNotSet";
const INVALID_LOT_MSG = "The value of Lot is empty.";
const INVALID_INVUSE_LINES_LOT = "invalid_invuse_lines_lot";
const INVALID_INVUSE_LINES_LOT_MSG =
  "Usage lines - {0} - from the Inventory Usage application. Please set the missing Lot values.";
const INVALIDSPLIT_DIALOG_TITLE = "invalidSplit_dialog_title";
const INVALIDSPLIT_DIALOG_TITLE_MSG = "Invalid Split Account";
const INVALIDGLACCOUNT_DIALOG_TITLE = "invalidGLAccount_dialog_title";
const INVALIDGLACCOUNT_DIALOG_TITLE_MSG = "Invalid Charge Account";
const INVALID_GLACCOUNT = "invalidGLAccount";
const INVALID_GLACCOUNT_MSG =
  "Some inventory usage lines have missing or invalid charge account information and cannot be issued.";
const ONLY_SUPPORT_RESERVED_ITEMS = "onlySupportReservedItems";
const ONLY_SUPPORT_RESERVED_ITEMS_MSG =
  "Items without reservations must be issued from the Inventory Usage application.";
const INVUSESTATUS_SYNONYM_DOMAINID = "INVUSESTATUS";
const INVUSETYPE_SYNONYM_DOMAINID = "INVUSETYPE";
const INVUSE_STATUS_COMP = "COMPLETE";
const INVUSE_STATUS_STAGED = "STAGED";
const ITEMTYPE_SYNONYM_DOMAINID = "ITEMTYPE";
const INVALIDROTASSET_DIALOG_TITLE = "invalidRotAsset_dialog_title";
const INVALIDROTASSET_DIALOG_TITLE_MSG = "Invalid Rotating Asset";
const INVALID_ROTASSET = "invalidRotAsset";
const INVALID_ROTASSET_MSG =
  "Some inventory usage lines have missing or invalid rotating assets and cannot be issued.";
const INVALID_INVUSE_LINES_ROTASSET = "invalid_invuse_lines_rotasset";
const INVALID_INVUSE_LINES_ROTASSET_MSG =
  "Usage lines - {0} - from the Inventory Usage application. Please provide the missing information.";
const ADDOPTIONSDS = "addoptionsDS";
const reservationsListPage = "reservationsList";
const mainPage = "main";
const invUsageListPage = "invUsageList";
const invItemListPage = "inventoryitemlist";
const ISSUE = "ISSUE";
const TRANSFER = "TRANSFER";
const RETURN = "RETURN";
const MIXED = "MIXED"; // custom logic to include constant (Sedin Change)
const LOT = "LOT";
const TRANSFERSECTION = "TRANSFERDETAIL";
const INVENTORY = "inventory";
const RESERVED = "reserved";
const SHIPPED_STATUS = "SHIPPED";
const TOOL = "TOOL";

const CREATE_SHIPMENT_DIALOG = "createShipmentDialog";

const DS_ATTR_SHIPMENTDATE = "shipmentdate";

class InventoryUsagePageController {
  pageInitialized(page, app) {
    this.app = app;
    this.page = page;
    this.invuselines = [];
    this.page.state.invUsageLineItemFields = {};
  }

  pageResumed() {
    // entering this page, either new or modify existing, both are waiting to issue
    this.page.state.saveErr = null;
    this.page.state.isSaving = false;
    this.page.state.clearedAfterInitialLoading = false;
    this.page.state.assetrefreshing = false;
    this.page.state.stagedItem = false;
    this.page.state.completedItem = false;
    this.page.state.shippedItem = false;
    let reserveditems = this.page.params.items || [];
    this.page.state.title =
      this.page.params.title ||
      this.app.getLocalizedLabel(
        "createInvUsage",
        "Create inventory usage record"
      );
    this.page.state.addingmoreitems = this.page.params.addingmoreitems;
    // keep current draftInvUsage value if not set true in page param
    //istanbul ignore else
    if (this.page.params.draftInvUsage) {
      this.page.state.draftInvUsage = this.page.params.draftInvUsage;
    }
    this.page.state.entryType = this.page.params.entryType || null;
    this.page.state.itemUrl = this.page.params.itemUrl || null;
    this.page.state.invUsageLineSplitItem = null;
    this.page.state.invUsageLineItem = null;
    this.page.state.currentInvUse = null;
    this.page.state.itemsInvUsage = [];
    this.page.state.readonlyState = false;
    this.page.state.binflag = "1";
    this.page.state.stagingbin = "";

    //istanbul ignore else
    if (this.page.state.itemUrl) {
      this.page.state.invusagedesc =
        this.page.params.description === undefined
          ? ""
          : this.page.params.description;
      // custom logic to include bpuissueto and bpuwonum (Sedin Change)
      this.page.state.bpuissueto =
        this.page.params.bpuissueto === undefined
          ? ""
          : this.page.params.bpuissueto;
      this.page.state.bpuwonum =
        this.page.params.bpuwonum === undefined
          ? ""
          : this.page.params.bpuwonum;
      // coming from inventory usage list page, already saved, set draft to false
      this.page.state.draftInvUsage = false;
    }

    // reset invalidInput for a new session
    // istanbul ignore else
    if (!this.page.state.addingmoreitems) {
      this.page.state.invalidInput = new Set();
    }

    // when enter from invusage record list page, the draftInvUsage is false
    //istanbul ignore else
    if (this.page.params.usetype) { // Custom logic start (Sedin Change)
      // draft usage, set page.state.usetype_maxvalue to ISSUE or TRANSFER
      const typeList = [ISSUE, TRANSFER, MIXED]; 
      if (typeList.includes(this.page.params.usetype)) {
        this.page.state.usetype_maxvalue = this.page.params.usetype;
        this.page.state.usetype_value = this.page.params.usetype;
        switch (this.page.state.usetype_maxvalue) {
          case ISSUE:
            this.page.state.finalActionLabel = this.app.getLocalizedLabel("issue_button", "Complete issue");
            break;
          case TRANSFER:
            this.page.state.finalActionLabel = this.app.getLocalizedLabel("transfer_button", "Complete transfer",);
            break;
          case MIXED: 
            this.page.state.finalActionLabel = this.app.getLocalizedLabel("return_button", "Complete Return");
            break;
          default:
            this.page.state.finalActionLabel = ""; 
            break;
        } // Custom logic end (Sedin Change)
      } else {
        // should not go with bad types
        this.page.state.usetype_maxvalue = "";
        this.page.state.usetype_value = "";
        this.page.state.usetype_description = "";
      }
    }

    //istanbul ignore else
    if (
      this.page.state.draftInvUsage &&
      this.page.state.invusagefromstoreloc === ""
    ) {
      // draft usage, set page.state.invusagefromstoreloc to user's defalut storeroom
      this.page.state.invusagefromstoreloc =
        this.app.client.userInfo.defaultStoreroom;
      // this.app.client.userInfo.defaultStoreroomSite <=> inventory.siteid
      // this.page.state.invusagefromstoreloc <=> inventory.location
    }

    this.assetLookupDS = this.app.findDatasource("assetLookupDS");
    this.issuetoLookupDS = this.app.findDatasource("issuetoLookupDS");
    this.binLookupDS = this.page.datasources["inventbalDS"];
    this.invUsageDS = this.app.findDatasource(
      this.app.state.selectedInvUseDSName
    );
    this.page.state.invUsageDS = this.invUsageDS;
    this.invusagejsonds = this.page.findDatasource("jsoninusageDS");
    this.invsplitjsonDS = this.page.findDatasource("invsplitjsonDS");
    this.addoptionsds = this.app.findDatasource(ADDOPTIONSDS);
    this.synonymDomainsDS = this.app.findDatasource("synonymdomainDS");
    this.page.state.confirmStageBin0 = this.app.getLocalizedLabel(
      "confirmStageBin0",
      "Use the default stage bin for each item."
    );
    this.page.state.confirmStageBin1 = this.app.getLocalizedLabel(
      "confirmStageBin1",
      "Use a new stage bin that will be used for all usage lines being staged."
    );
    this.page.state.confirmStageBin2 = this.app.getLocalizedLabel(
      "confirmStageBin2",
      "Use the current bin."
    );
    /** this.page.state.usetype_maxvalue !== "TRANSFER"
      ? (this.page.state.labelQuantityto = this.app.getLocalizedLabel(
          "quantityToIssue",
          "Quantity to issue"
        ))
      : (this.page.state.labelQuantityto = this.app.getLocalizedLabel(
          "quantityToTransfer",
          "Quantity to transfer"
        )); **/

        if (this.page.state.usetype_maxvalue === "TRANSFER")
          {
            this.page.state.labelQuantityto = this.app.getLocalizedLabel(
              "quantityToTransfer",
              "Quantity to transfer"
            )
          }
          else if (this.page.state.usetype_maxvalue === "ISSUE")
          {
            this.page.state.labelQuantityto =  this.app.getLocalizedLabel(
              "quantityToIssue",
              "Quantity to issue"
            )
          }
          else if (this.page.state.usetype_maxvalue === "MIXED")
          {
            this.page.state.labelQuantityto = "Quantity to Return"
          }


          if (this.page.state.usetype_maxvalue === "MIXED")
          {
            this.page.state.labelBin = "To Bin"
          }
          else
          {
            this.page.state.labelBin = "From bin"
          }

    // reserveditems to this page are all not saved
    reserveditems?.forEach((item) => {
      item._notSaved = true;
    });
    this.setUpInitialDataSource(reserveditems);
  }

  async setUpInitialDataSource(reserveditems) {
    //istanbul ignore else
    if (this.page.state.usetype_maxvalue) {
      // process usetype
      const itemObj = await CommonUtil.cacheSynonymdomain(
        this.app,
        INVUSETYPE_SYNONYM_DOMAINID,
        {
          key: "maxvalue",
          value: this.page.state.usetype_maxvalue,
        }
      );
      this.page.state.usetype_value = itemObj.value;
      //istanbul ignore next
      this.page.state.usetype_description =
        itemObj.description || itemObj.value;
    }
    if (!this.page.state.itemUrl) {
      //it's a new Inventory Usage record

      if (!this.page.state.addingmoreitems) {
        // it's the init load for new record - right after clicking Issue/Transfer action.
        await this.loadNewInventoryUsage();
      } else {
        //it's adding new items after selecting items from reservation/inventory items/tools.
        //load previous selected items and then the newly selected items.
        await this.updatePreviousSelectedItems(reserveditems);
      }
    } else {
      //it's an existing Inventory Usage record

      const invUsageItem =
        (await this.invUsageDS?.load({
          noCache: true,
          itemUrl: this.page.state.itemUrl,
        })) || [];

      this.page.state.currentInvUse = this.invUsageDS?.item;

      //istanbul ignore else
      if (this.page.state.currentInvUse !== undefined) {
        // existing usage, get values of from the current usage, and set to page.state.*.
        // For the scenario when it's from the error log of Navigator, we only have itemUrl/href,
        this.page.state.title = this.page.state.currentInvUse.invusenum;
        this.page.state.invusagedesc =
          this.page.state.currentInvUse.description;
        this.page.params.description =
          this.page.state.currentInvUse.description;
        // Customization to include bpuissueto and bpuwonum (sedin change)
        this.page.state.bpuissueto =
          this.page.state.currentInvUse.bpuissueto;
        this.page.params.bpuissueto =
          this.page.state.currentInvUse.bpuissueto;
        this.page.state.bpuwonum =
          this.page.state.currentInvUse.bpuwonum;
        this.page.params.bpuwonum =
          this.page.state.currentInvUse.bpuwonum;

        this.page.state.invusagefromstoreloc =
          this.page.state.currentInvUse.fromstoreloc;
        this.page.state.usetype_value = this.page.state.currentInvUse.usetype;
        // change this to this.page.state.usetype_maxvalue, and set this.page.state.usetype_value = this.page.state.currentInvUse?.usetype.
        // For the offline data not synced yet, usertype_maxvalue may not be set, use usetype from maxvalue(we passsed maxvalue during creating invuse record, so maxvalue may be stored locally already, double check).
        this.page.state.usetype_maxvalue =
          this.page.state.currentInvUse.usetype_maxvalue ||
          this.page.state.currentInvUse.usetype;
        this.page.state.usetype_description =
          this.page.state.currentInvUse.usetype_description ||
          this.page.state.currentInvUse.usetype;
      }

      if (!this.page.state.addingmoreitems) {
        // it's the init load for the record

        //Clean the current json datasource
        await this.invusagejsonds.load({ src: [], noCache: true });

        // filter out autocreated true in split item
        invUsageItem.forEach((invusage) => {
          invusage.invuseline?.forEach((invuseline) => {
            //istanbul ignore else
            if (invuseline.invuselinesplit) {
              invuseline.invuselinesplit = invuseline.invuselinesplit.filter(
                (split) => !split.autocreated
              );
              //istanbul ignore next
              if (!invuseline.invuselinesplit.length) {
                delete invuseline.invuselinesplit;
              }
            }
          });
        });
        this.updatePageInvUseLines(invUsageItem);
        await this.loadAddNewItems(this.invuselines);
      } else {
        //it's adding new items
        await this.updatePreviousSelectedItems(reserveditems);
      }
    }

    //istanbul ignore next
    let status = this.page.state.currentInvUse?.status_maxvalue;
    if (status === "COMPLETE") {
      this.page.state.readonlyState = true;
    } else if (status === "STAGED") {
      this.page.state.stagedItem = true;
    }

    // check save action enabled after setup
    this.computeEnableSave();
    this.validateInvUsage();
  }

  async updatePreviousSelectedItems(selectedItems) {
    let maxLineNum = 0;
    let newItemsArray = [];
    let previousjsonItems = this.invusagejsonds.getItems();

    //istanbul ignore next
    this.invusagejsonds.getItems()?.forEach((item) => {
      maxLineNum =
        item.invuselinenum >= maxLineNum ? item.invuselinenum : maxLineNum;
    });

    //istanbul ignore else
    if (selectedItems && selectedItems.length && previousjsonItems) {
      let previousnotselecteditems;

      // get correct itemtype from synonymdomain
      const itemObj = await CommonUtil.cacheSynonymdomain(
        this.app,
        ITEMTYPE_SYNONYM_DOMAINID,
        {
          key: "maxvalue",
          value: "ITEM",
        }
      );

      selectedItems?.forEach((item) => {
        previousnotselecteditems = previousjsonItems.find(
          // reserved item: requestnum, inventory item: itemnum, itemtype:"item", requestnum:undefined
          (temp) => {
            let result = false;
            switch (this.page.state.entryType) {
              case INVENTORY:
                result =
                  item.itemnum === temp.itemnum &&
                  item.itemtype === itemObj.value &&
                  !item.requestnum &&
                  temp.itemtype === itemObj.value &&
                  !temp.requestnum;
                break;
              case RESERVED:
                result = item.requestnum === temp.requestnum;
                break;
            }
            return result;
          }
        );
        //istanbul ignore else
        if (
          this.page.state.entryType === INVENTORY ||
          (this.page.state.entryType !== INVENTORY && !previousnotselecteditems)
        ) {
          newItemsArray.push(item);
        }
      });
    }

    //istanbul ignore else
    if (newItemsArray && newItemsArray.length) {
      for (let i = 0; i < newItemsArray.length; i++) {
        let newItemDS = await this.invusagejsonds.addNew();
        await this.updateByCopyInfoFromNewSelected(
          newItemDS,
          newItemsArray[i],
          ++maxLineNum
        );
      }
    }
    this.page.state.itemsInvUsage = this.invusagejsonds.getItems();
  }

  updatePageInvUseLines(invUsageItem) {
    // find invuseline in invusageDS
    let invuseline = [];
    let reserveitems = this.app.allreserveditems || [];
    invUsageItem.forEach((usageItem) => {
      //istanbul ignore else
      if (usageItem.invuseline && usageItem.invuseline.length) {
        invuseline = invuseline.concat(
          usageItem.invuseline.filter((item) => item.itemnum !== undefined)
        );

        for (let i = 0; i < usageItem.invuseline.length; i++) {
          //istanbul ignore else
          if (usageItem.invuseline[i].itemnum !== undefined) {
            for (
              let j = 0;
              j < usageItem.invuseline[i].invreserve?.length;
              j++
            ) {
              let invReserveCoppied = CommonUtil.getCopiedInvReserve(
                usageItem.invuseline[i].invreserve[j],
                usageItem
              );
              // istanbul ignore else
              if (
                reserveitems.filter(
                  (item) => item.invreserveid === invReserveCoppied.invreserveid
                ).length === 0
              ) {
                reserveitems.push(invReserveCoppied);
              }
            }
          }
        }
      }
    });
    let siteidValue = invUsageItem[0]?.siteid;
    //istanbul ignore else
    if (siteidValue && siteidValue !== undefined) {
      this.invuselines = invuseline.map((item) =>
        Object.assign(item, { siteid: siteidValue })
      );
    }
    // this.app.allreserveditems and reserveitems point to the same obj
    // this.app.allreserveditems = reserveitems;
  }

  /*
   * For the invuselines of the current invuse, remove them and replace with the updated created one if no response error or need to add the saved records forcely.
   */
  updateAppInvUseLines(usageItem, hasResponseErrorOrNoNeed2AddBack) {
    // find invuseline in invusageDS
    let invuselines = this.app.allinvuses;

    //istanbul ignore else
    if (usageItem.invuseline && usageItem.invuseline.length) {
      for (let i = 0; i < usageItem.invuseline.length; i++) {
        //istanbul ignore else
        if (
          usageItem.invuseline[i].itemnum !== undefined &&
          usageItem.invuseline[i].itemnum !== ""
        ) {
          let invUseLineCoppied = CommonUtil.getCopiedInvUseLine(
            usageItem.invuseline[i],
            usageItem
          );
          // istanbul ignore else
          if (this.app.device.isMaximoMobile) {
            // For mobile, no invusenum for now and invuseid will be changed after save.
            //if (isAfterSave || !this.page.state.draftInvUsage || this.page.state.addingmoreitems) {
            //istanbul ignore next
            invuselines = invuselines.filter(
              (eachline) =>
                !(
                  (eachline.anywhererefid === undefined &&
                    eachline.invuseid === invUseLineCoppied.invuseid &&
                    eachline.invuselinenum ===
                      invUseLineCoppied.invuselinenum &&
                    eachline.siteid === invUseLineCoppied.siteid) ||
                  (eachline.anywhererefid !== undefined &&
                    eachline.anywhererefid === invUseLineCoppied.anywhererefid)
                )
            );
            //}
          } else {
            // Removes the temp invuseline in the array and then will push the saved persistent one.
            // For web version, we have to use invusenum because invuseid could be changed.
            //istanbul ignore next
            invuselines = invuselines.filter(
              (eachline) =>
                !(
                  eachline.invusenum === invUseLineCoppied.invusenum &&
                  eachline.invuselinenum === invUseLineCoppied.invuselinenum &&
                  eachline.siteid === invUseLineCoppied.siteid
                )
            );
          }
          //istanbul ignore else
          if (!hasResponseErrorOrNoNeed2AddBack) {
            // When got save error, no need to push back anything after cleaning the temp invuseline in the array.
            // For newly added one, just adde it. For existing one, replace with the latest.
            invuselines.push(invUseLineCoppied);
          }
        }
      }
    }

    this.app.allinvuses = invuselines;
  }

  async loadNewInventoryUsage() {
    this.page.state.draftInvUsage = true;
    this.page.state.invusagedesc = "";
    //Customization to include bpuissueto and bpuwonum (sedin change)
    this.page.state.bpuissueto = "";
    this.page.state.bpuwonum = "";
    await this.invusagejsonds.load({ src: [], noCache: true }); //Clean the current json datasource
    this.page.state.itemsInvUsage = [];
  }

  /**
   * Copies new selected items info into InvUseLine, referring to the logic from Maximo side.
   * */
  async updateByCopyInfoFromNewSelected(
    createdItem,
    newSelectedItem,
    numdefined
  ) {
    // NOTICE: we should make the change to createdItem, refer to the new crerated item
    const copiedCreatedItem = Object.assign({}, createdItem);
    let item = createdItem;
    for (let key in newSelectedItem) {
      item[key] = newSelectedItem[key];
    }
    // write back some fields overwritten by newSelectedItem
    for (let key in copiedCreatedItem) {
      item[key] = copiedCreatedItem[key];
    }
    // updated for GRAPHITE-72274
    // istanbul ignore else
    if (this.page.state.addingmoreitems) {
      item.quantity = newSelectedItem.calqty || 1;
    }

    // TODO: double check the fields in different type
    item.description =
      newSelectedItem.itemdes ||
      newSelectedItem.itemdesc ||
      newSelectedItem.description ||
      newSelectedItem.item?.description;
    item.computedDueDate =
      newSelectedItem.computedDueDate ||
      this.computedDueDate(newSelectedItem.invreserve || []);
    item.frombin = newSelectedItem.binnum;
    item.fromstoreloc = newSelectedItem.location;
    item.fromconditioncode = newSelectedItem.conditioncode;
    item.location = newSelectedItem.oplocation;
    item.siteid = newSelectedItem.storelocsiteid;
    item.tositeid = newSelectedItem.siteid;
    // for computed fields, some for inventory item, some for reserved item
    item.computedItemType = newSelectedItem.itemtype;
    item.computedIssueUnit = newSelectedItem.issueunit;
    item.computedAvblbalance = newSelectedItem.avblbalance;
    item.computedResType = newSelectedItem.restype;
    item.computedReservedQty = newSelectedItem.reservedqty;
    item.computedDueDate = newSelectedItem.requireddate
      ? this.app.dataFormatter
          .convertISOtoDate(newSelectedItem.requireddate)
          .toLocaleDateString()
      : "";
    //istanbul ignore else
    if (newSelectedItem.item) {
      item.computedRotating = newSelectedItem.item.rotating
        ? this.app.getLocalizedLabel("yes", "Yes")
        : this.app.getLocalizedLabel("no", "No");
    }

    // config linetype
    item.linetype = newSelectedItem.itemtype;
    // query to set linetype_maxvalue
    const itemObj = await CommonUtil.cacheSynonymdomain(
      this.app,
      ITEMTYPE_SYNONYM_DOMAINID,
      {
        key: "value",
        value: newSelectedItem.itemtype,
      }
    );
    item.linetype_maxvalue = itemObj.maxvalue;
    // bring the usetype to invuseline item
    //item.usetype_maxvalue = this.page.state.usetype_maxvalue;
    if (this.page.state.usetype_maxvalue == MIXED) {
      item.usetype_maxvalue = 'RETURN'
      item.usetype = 'RETURN'
    } else {
      item.usetype_maxvalue = this.page.state.usetype_maxvalue
    }

    // Let maximo side to handle GLAccount.
    // istanbul ignore else
    // if (
    //   newSelectedItem.glaccount !== undefined &&
    //   newSelectedItem.glaccount !== null
    // ) {
    //   item.gldebitacct = newSelectedItem.glaccount;
    // }

    item.refwo = newSelectedItem.wonum;
	// Sedin(change) Copy header-level work order to line level
	item.refwo = this.page.state.bpuwonum || newSelectedItem.wonum;
	item.wonum = this.page.state.bpuwonum || newSelectedItem.wonum;	

	// Sedin(change)  Copy header-level issue to person to line level  
	item.issueto = this.page.state.bpuissueto || newSelectedItem.requestedby;
    item.invuselinenum = numdefined;

    // must remove unused fields
    const excludesFields = [
      "href",
      "_bulkid",
      "_dbid",
      "_rowstamp",
      "_selected",
      "status",
      "status_description",
      "status_maxvalue",
    ];
    excludesFields.forEach((field) => {
      delete item[field];
    });
    item.anywhererefid = new Date().getTime();
    return item;
  }

  computedDueDate(invreserve) {
    let dueDate = "";
    //istanbul ignore else
    if (invreserve && invreserve.length) {
      invreserve.forEach((reserve) => {
        //istanbul ignore else
        if (reserve.requireddate) {
          //istanbul ignore else
          if (!dueDate || reserve.requireddate < dueDate) {
            dueDate = reserve.requireddate;
          }
        }
      });
      //istanbul ignore next.
      dueDate = dueDate
        ? this.app.dataFormatter.convertISOtoDate(dueDate).toLocaleDateString()
        : "";
    }
    return dueDate;
  }

  // initial load for existing invusage record
  async loadAddNewItems(mixedItems) {
    let previousSelected = this.page.state.itemsInvUsage;
    let newItemsArray = [];
    let currentApp = this.app;
    //istanbul ignore else
    if (mixedItems && mixedItems.length > 0) {
      let itemAlreadySelected = "";
      let allrsveditems = this.app.allreserveditems || [];

      // As mixedItems are from existing record, we can check invuselinenum as unique id
      mixedItems.forEach((item) => {
        itemAlreadySelected = false;
        //istanbul ignore else
        if (previousSelected) {
          itemAlreadySelected = previousSelected.find(
            (itemPrevious) => itemPrevious.invuselinenum === item.invuselinenum
          );
        }
        // TODO: check for reserved items and other items
        //istanbul ignore else
        if (!itemAlreadySelected) {
          // Specific logic for unique id.
          //istanbul ignore else
          if (!item._id) {
            item._id = item.invuselinenum;
          }
          // For reserved items
          //istanbul ignore else
          if (item.itemnum !== undefined && item.requestnum !== undefined) {
            let invReservesRelated = allrsveditems.filter(
              (reserveditem) =>
                reserveditem.requestnum === item.requestnum &&
                reserveditem.siteid === item.siteid
            );

            //istanbul ignore else
            if (invReservesRelated[0]) {
              const totalQtyUsed = CommonUtil.getTotalQtyUsed(
                invReservesRelated[0],
                this.app,
                item.quantity
              );
              invReservesRelated[0].calqty =
                invReservesRelated[0].reservedqty - totalQtyUsed;
              item.calqty = invReservesRelated[0].calqty;
              item.computedDueDate = CommonUtil.computeDueDate(
                invReservesRelated[0].requireddate,
                currentApp
              );
            }
          }
          newItemsArray.push(item);
        }
      });
    }

    // no need to find maxLineNum as we don't use addNew() here
    // let maxLineNum = 0;
    // //istanbul ignore next
    // this.invusagejsonds.getItems().forEach((item) => {
    //   maxLineNum =
    //     item.invuselinenum >= maxLineNum ? item.invuselinenum : maxLineNum;
    // });

    await this.invusagejsonds.load({
      src: newItemsArray,
      noCache: true,
    });
    this.page.state.itemsInvUsage = this.invusagejsonds.getItems();
  }

  async saveInventoryUsage(needsSave = true) {
    this.setSavingProcess(true);
    this.page.state.saveErr = null;
    this.page.state.saveValidationErr = null;

    if (!this.validateInvUsage()) {
      this.page.state.saveValidationErr_title = this.app.getLocalizedLabel(
        "validationIssues",
        "Validation issues"
      );

      this.page.showDialog(INVUSE_SAVE_VALIDATION_ERR_DIALOG);
      this.setSavingProcess(false);
      return false;
    }

    // validate lot with lottype_maxvalue is LOT
    let invalidLotLines = this.getLinesOfInvalidLot();
    //istanbul ignore else
    if (invalidLotLines.length > 0) {
      this.page.state.saveValidationErr_title = this.app.getLocalizedLabel(
        INVALIDLOT_DIALOG_TITLE,
        INVALIDLOT_DIALOG_TITLE_MSG
      );

      this.page.state.saveValidationErr = this.app.getLocalizedLabel(
        INVALID_LOT,
        INVALID_LOT_MSG
      );

      this.page.state.saveValidationErr_lineinfo = this.app.getLocalizedLabel(
        INVALID_INVUSE_LINES_LOT,
        INVALID_INVUSE_LINES_LOT_MSG,
        [invalidLotLines]
      );

      this.page.showDialog(INVUSE_SAVE_VALIDATION_ERR_DIALOG);
      this.setSavingProcess(false);
      return false;
    }

    // Split validation.
    let invalidLines = this.getLinesOfInvalidSplit();
    //istanbul ignore else
    if (invalidLines.length > 0) {
      this.page.state.saveValidationErr_title = this.app.getLocalizedLabel(
        INVALIDSPLIT_DIALOG_TITLE,
        INVALIDSPLIT_DIALOG_TITLE_MSG
      );

      this.page.state.saveValidationErr = this.app.getLocalizedLabel(
        QUANTITY_NOT_MATCH,
        QUANTITYNOTMATCH_MSG
      );

      //this.page.state.saveErr = this.page.state.saveValidationErr;

      this.page.state.saveValidationErr_lineinfo = this.app.getLocalizedLabel(
        INVALID_INVUSE_LINES,
        INVALID_INVUSE_LINES_MSG,
        [invalidLines]
      );

      this.page.showDialog(INVUSE_SAVE_VALIDATION_ERR_DIALOG);
      this.setSavingProcess(false);
      return false;
    }

    // GLAccount validataion.
    // invalidLines = this.getLinesOfInvalidGLAccount();
    // //istanbul ignore else
    // if (invalidLines.length > 0) {
    //   this.page.state.saveValidationErr_title = this.app.getLocalizedLabel(
    //     INVALIDGLACCOUNT_DIALOG_TITLE,
    //     INVALIDGLACCOUNT_DIALOG_TITLE_MSG
    //   );

    //   this.page.state.saveValidationErr = this.app.getLocalizedLabel(
    //     INVALID_GLACCOUNT,
    //     INVALID_GLACCOUNT_MSG
    //   );

    //   //this.page.state.saveErr = this.page.state.saveValidationErr;
    //   this.page.state.saveValidationErr_lineinfo = this.app.getLocalizedLabel(
    //     INVALID_INVUSE_LINES,
    //     INVALID_INVUSE_LINES_MSG,
    //     [invalidLines]
    //   );
    //   this.page.showDialog(INVUSE_SAVE_VALIDATION_ERR_DIALOG);
    //   this.setSavingProcess(false);
    //   return false;
    // }

    //validate Rotating Assets
    let invalidLinesRotatingAssets = this.validateRotatingAssets();

    if (invalidLinesRotatingAssets.length > 0) {
      this.page.state.saveValidationErr_title = this.app.getLocalizedLabel(
        INVALIDROTASSET_DIALOG_TITLE,
        INVALIDROTASSET_DIALOG_TITLE_MSG
      );

      this.page.state.saveValidationErr = this.app.getLocalizedLabel(
        INVALID_ROTASSET,
        INVALID_ROTASSET_MSG
      );

      this.page.state.saveValidationErr_lineinfo = this.app.getLocalizedLabel(
        INVALID_INVUSE_LINES_ROTASSET,
        INVALID_INVUSE_LINES_ROTASSET_MSG,
        [invalidLinesRotatingAssets]
      );
      this.page.showDialog(INVUSE_SAVE_VALIDATION_ERR_DIALOG);
      this.setSavingProcess(false);
      return false;
    }

    if (!needsSave) {
      this.setSavingProcess(false);
      return true;
    }

    // for each item in this.invusagejsonds.items, if contains split data
    // force assign frombin in 1st split item with non empty frombin to item.frombin
    this.invusagejsonds.items.forEach((item) => {
      //istanbul ignore else
      if (item.invuselinesplit && item.invuselinesplit.length) {
        for (let i = 0; i < item.invuselinesplit.length; i++) {
          //istanbul ignore else
          if (item.invuselinesplit[i].frombin) {
            item.frombin = item.invuselinesplit[i].frombin;
            break;
          }
        }
      }
    });

    let initialStatus = "ENTERED";
    const itemObj = await CommonUtil.cacheSynonymdomain(
      this.app,
      INVUSESTATUS_SYNONYM_DOMAINID,
      {
        key: "valueid",
        value: `${INVUSESTATUS_SYNONYM_DOMAINID}|${initialStatus}`,
      }
    );
    //istanbul ignore else
    if (itemObj) {
      initialStatus = itemObj.value;
    }

    if (this.page.state.draftInvUsage) {
      //istanbul ignore else
      if (!this.invUsageDS.getSchema()) {
        await this.invUsageDS.initializeQbe();
      }
      let newInvUsage = await this.invUsageDS.addNew();

      newInvUsage.usetype = this.page.state.usetype_value;
      newInvUsage.usetype_maxvalue = this.page.state.usetype_maxvalue;
      newInvUsage.usetype_description =
        this.page.state.usetype_description || this.page.state.usetype_value;
      newInvUsage.status = initialStatus;
      newInvUsage.fromstoreloc = this.app.client.userInfo.defaultStoreroom;
      newInvUsage.orgid = this.app.client.userInfo.defaultOrg;
      newInvUsage.siteid = this.app.client.userInfo.defaultStoreroomSite;
      newInvUsage.description = this.page.state.invusagedesc;
      // Customization to add bpuissueto and bpuwonum (sedin change)
      newInvUsage.bpuissueto = this.page.state.bpuissueto;
      newInvUsage.bpuwonum = this.page.state.bpuwonum;
      newInvUsage.invuseline = this.invusagejsonds.items;
    } else {
      this.invUsageDS.item.description = this.page.state.invusagedesc;
      this.invUsageDS.item.invuseline = this.invusagejsonds.items;
      // Customization to add bpuissueto and bpuwonum (sedin change)
      this.invUsageDS.item.bpuissueto = this.page.state.bpuissueto;
      this.invUsageDS.item.bpuwonum = this.page.state.bpuwonum;

      // we have to set status field in changes to make api work, even there's no change on status
      //istanbul ignore else
      if (this.invUsageDS.__itemChanges) {
        const changes = this.invUsageDS.__itemChanges;
        for (let key in changes) {
          //istanbul ignore else
          if (!changes[key].status) {
            changes[key].status = [
              {
                name: "status",
                type: "update",
                newValue: this.invUsageDS.item.status,
                oldValue: this.invUsageDS.item.status,
                object: this.invUsageDS.item,
              },
            ];
          }
        }
      }
    }
    // for mobile remove _rowstamp in invuseline and invuselinesplit
    //istanbul ignore else
    if (this.app.device.isMaximoMobile && this.invUsageDS.item) {
      this.invUsageDS.item.invuseline?.forEach((line) => {
        delete line["_rowstamp"];
        line.invuselinesplit?.forEach((split) => {
          delete split["_rowstamp"];
        });
      });
    }
    return await this.triggerSaveProcess(this.invUsageDS);
  }

  /**
   * Function to validate : If it's a Rotating Item - needs an Asset Assigned
   */
  validateRotatingAssets() {
    let invalidLines = [];
    this.invusagejsonds.items.forEach((lineItem) => {
      let rotating = this.getRotating(lineItem);

      //istanbul ignore else
      if (rotating) {
        //istanbul ignore else
        if (!lineItem.invuselinesplit) {
          lineItem.isInValid = true;
          invalidLines.push(lineItem.invuselinenum);
        }

        lineItem.invuselinesplit?.forEach((asset) => {
          //istanbul ignore else
          if (!asset.rotassetnum) {
            lineItem.isInValid = true;
            invalidLines.push(lineItem.invuselinenum);
          }
        });
      }
    });
    return invalidLines;
  }

  /**
   * NOTICE: if the lineitem is from reserved item, it has item.rotating
   * if the lineitem is from saved invuseline item, it does not have item.rotating
   * check item[0].rotating or rotating from invreserve[0].item[0].rotating
   */
  getRotating(lineItem) {
    let rotating = false;
    //istanbul ignore else
    if (lineItem.item) {
      //istanbul ignore else
      if (lineItem.item.rotating) {
        rotating = lineItem.item.rotating;
      } else if (lineItem.item.length > 0) {
        rotating = lineItem.item[0].rotating;
      }
    } else if (lineItem.invreserve) {
      rotating = lineItem.invreserve[0].item[0].rotating;
    }

    return rotating;
  }

  getLinesOfInvalidLot() {
    let invalidLines = [];
    // check each invuseline for lottype_maxvalue is LOT and fromlot is empty
    this.invusagejsonds.items.forEach((lineItem) => {
      //istanbul ignore else
      if (
        (lineItem.lottype_maxvalue === LOT ||
          lineItem.item?.lottype_maxvalue === LOT ||
          lineItem.item[0]?.lottype_maxvalue === LOT) &&
        !lineItem.fromlot
      ) {
        lineItem.isInValid = true;
        invalidLines.push(lineItem.invuselinenum);
      }
    });
    return invalidLines;
  }

  getLinesOfInvalidSplit() {
    let invalidLines = [];
    // set autocreated field in split to false to make it work as expected
    this.invusagejsonds.items.forEach((lineItem) => {
      //istanbul ignore else
      if (lineItem.invuselinesplit && lineItem.invuselinesplit.length) {
        // check quantity
        let total = 0;
        lineItem.invuselinesplit.forEach((splitItem) => {
          const keepFields = [
            "quantity",
            "frombin",
            "rotassetnum",
            "itemsetid",
            "itemnum",
            "orgid",
          ];
          //istanbul ignore else
          if (splitItem.autocreated) {
            // FIXME: as we won't have autocreated true anymore, can be removed safely?
            for (let k in splitItem) {
              //istanbul ignore else
              if (!keepFields.includes(k)) {
                // delete fields href, localref, invuselinesplitid, etc
                delete splitItem[k];
              }
            }
            splitItem._addNew = true;
            splitItem.contentuid = uuidv4();
          } else {
            // do not calculate those with autocreated true
            total += splitItem.quantity;
          }
          splitItem.autocreated = false;
          splitItem.contentuid = splitItem.contentuid || uuidv4();
          if (!splitItem.anywhererefid) {
            splitItem.anywhererefid = new Date().getTime();
          }
        });
        //istanbul ignore else
        if (total !== lineItem.quantity) {
          lineItem.isInValid = true;
          invalidLines.push(lineItem.invuselinenum);
        }
      } else {
        lineItem.invuselinesplit = null;
        delete lineItem.invuselinesplit;
        // log.d(TAG, "line item: %o", lineItem);
      }
    });

    return invalidLines;
  }

  /**
   * GL Credit Account - not check for now.
   *
   * //lineItem.glcreditacct === undefined ||
   * //  lineItem.glcreditacct.indexOf("?") > 0 ||
   *
   * and at least one of the following fields populated
   *
   * 1. Asset (INVUSELINE.ASSETNUM)
   * 2. Location (INVUSELINE.LOCATION)
   * 3. WO (INVUSELINE.WONUM)
   * 4. Requisition (MR) (INVUSELINE.MRNUM)
   * 5. GL Debit Account (INVUSELINE.GLDEBITACCT)
   *
   */
  // getLinesOfInvalidGLAccount() {
  //   let invalidLines = [];
  //   // set autocreated field in split to false to make it work as expected
  //   this.invusagejsonds.items.forEach((lineItem) => {
  //     let rotating = this.getRotating(lineItem);

  //     //istanbul ignore else
  //     if (lineItem.requestnum === undefined &&
  //       ((!rotating &&
  //       lineItem.gldebitacct === undefined &&
  //       lineItem.assetnum === undefined &&
  //       lineItem.location === undefined) ||
  //       (rotating && lineItem.location === undefined))
  //     ) {
  //       lineItem.displaycolor = "red60";
  //       invalidLines.push(lineItem.invuselinenum);
  //     }
  //   });

  //   return invalidLines;
  // }

  async triggerSaveProcess(ds) {
    //istanbul ignore else
    if (
      !this.page.state.draftInvUsage &&
      ds.item.description !== this.page.state.invusagedesc
    ) {
      ds.item.description = this.page.state.invusagedesc;
    }
    // custom logic to include bpuissueto and bpuwonum (sedin change)
    //istanbul ignore else
    if (
      !this.page.state.draftInvUsage &&
      ds.item.bpuissueto !== this.page.state.bpuissueto
    ) {
      ds.item.bpuissueto = this.page.state.bpuissueto;
    }
	
    if (
      !this.page.state.draftInvUsage &&
      ds.item.bpuwonum !== this.page.state.bpuwonum
    ) {
      ds.item.bpuwonum = this.page.state.bpuwonum;
    } 

    // Updates this.app.allinvuses. For newly added invuseline rec, no invuselineid defined
    // Need to put all the unsaved invuseline into this.app.allinvuses before ds.save() for calculation purpose.
    this.updateAppInvUseLines(ds.currentItem);

    let response = await ds.save();

    if (response.error) {
      this.page.state.saveErr = response.error.message;
      // reload due to error
      // Moved to be after this.updateAppInvUseLines and this.invUsageDS.clearChanges().
      //await ds.forceReload();
    } else {
      this.page.state.saveErr = null;
      // update itemUrl
      this.page.state.itemUrl = ds.currentItem.href;
      this.page.params.description = this.page.state.invusagedesc;
      // custom logic to include bpuissueto and bpuwonum (sedin change)
      this.page.params.bpuissueto = this.page.state.bpuissueto;
      this.page.params.bpuwonum = this.page.state.bpuwonum;
      //istanbul ignore next
      const invUsageItem =
        (await ds?.load({
          noCache: true,
          itemUrl: this.page.state.itemUrl,
        })) || [];

      // filter out autocreated true in split item
      invUsageItem.forEach((invusage) => {
        invusage.invuseline?.forEach((invuseline) => {
          // set _notSaved false after saved
          invuseline._notSaved = false;
          //istanbul ignore else
          if (invuseline.invuselinesplit) {
            invuseline.invuselinesplit = invuseline.invuselinesplit.filter(
              (split) => !split.autocreated
            );
            //istanbul ignore next
            if (!invuseline.invuselinesplit.length) {
              delete invuseline.invuselinesplit;
            }
          }
        });
      });

      this.updatePageInvUseLines(invUsageItem);
      // update this.invusagejsonds

      // for mobile remove _rowstamp in invuseline
      //istanbul ignore else
      if (
        this.app.device.isMaximoMobile &&
        ds.currentItem.invuseline &&
        ds.currentItem.invuseline.length
      ) {
        ds.currentItem.invuseline.forEach((line) => {
          //istanbul ignore else
          if (line["_rowstamp"]) {
            delete line["_rowstamp"];
          }
          line.invuselinesplit?.forEach((split) => {
            //istanbul ignore else
            if (split["_rowstamp"]) {
              delete split["_rowstamp"];
            }
          });
        });
      }

      // update this.invusagejsonds
      let invuselineList = [];
      let oldInvUsageJSONItems = this.invusagejsonds.items;
      //istanbul ignore else
      ds.currentItem.invuseline?.forEach((invuseline) => {
        let eachitem = JSON.parse(JSON.stringify(invuseline));

        // For reserved item only
        //istanbul ignore else
        if (eachitem.requestnum !== undefined) {
          //istanbul ignore next
          let invReservesRelated = oldInvUsageJSONItems.filter(
            (item) =>
              item.requestnum === eachitem.requestnum &&
              (item.siteid === eachitem.siteid ||
                item.siteid === ds.currentItem.siteid)
          );
          //istanbul ignore else
          if (invReservesRelated[0]) {
            eachitem.siteid = invReservesRelated[0].siteid;
            eachitem.calqty = invReservesRelated[0].calqty;
            eachitem.computedDueDate = invReservesRelated[0].computedDueDate;
          }
        }

        // Specific logic for unique id.
        // Needs to set _id because no this attribute when loading from db. Specific logic for unique id.
        eachitem._id = eachitem.invuselinenum;
        invuselineList.push(eachitem);
      });

      await this.invusagejsonds.load({
        src: invuselineList,
        noCache: true,
      });

      this.page.state.draftInvUsage = false;
      this.app.currentPage.state.enableSave = false;

      let label = this.app.getLocalizedLabel(
        "invusage_saved",
        "Inventory usage Saved."
      );
      this.app.toast(label, "success", "");
      try {
        this.invsplitjsonDS.state.itemsChanged = false;
      } catch (e) {}
    }

    this.setSavingProcess(false);

    // Updates this.app.allinvuses after ds.save().
    // For the invuselines of the current invuse, remove them and replace with the updated created one if no response error or need to add the saved records forcely.
    this.updateAppInvUseLines(ds.currentItem, response.error);
    this.invUsageDS.clearChanges();
    //istanbul ignore else
    if (response.error) {
      // reload due to error
      await ds.forceReload();
    }
    // no saveErr means save successfully
    return !this.page.state.saveErr;
  }

  async triggerDeleteProcess(ds, items) {
    //istanbul ignore next
    try {
      await ds.deleteItems(items);
    } catch (error) {
      log.t(TAG, error);
    } finally {
      this.setSavingProcess(false);
    }
  }

  /**
   * Notify the execution page that save operation is running or not
   * @param {Boolean} isSaving  - Flag to idicate if the save is running
   */
  setSavingProcess(isSaving) {
    //istanbul ignore else
    if (this.app?.currentPage?.state) {
      this.app.currentPage.state.isSaving = isSaving;
    }
  }

  setStatusProcess(isChanging) {
    //istanbul ignore else
    if (this.app?.currentPage?.state) {
      this.app.currentPage.state.isStatusChanging = isChanging;
    }
  }

  exitOptProcess() {
    this.setSavingProcess(false);
    this.setStatusProcess(false);
  }

  /**
   * Validates input values.
   *
   */
  validateInput(event) {
    // use invalidInput set to record the invalid item
    // istanbul ignore else
    if (event.quantity === undefined || event.quantity === "") {
      // disable save and issue button if not set quantity
      this.app.currentPage.state.enableSave = false;
      this.app.currentPage.state.invalidInput.add(event.anywhererefid);
      this.validateInvUsage();
      return;
    }

    // Validates input
    const exceedlimitMessage = this.app.getLocalizedLabel(
      "exceedreserved",
      "The number cannot exceed total reserved amount."
    );
    const expectedNumberMessage = this.app.getLocalizedLabel(
      "expectnumber",
      "Enter a number greater than zero."
    );

    if (isNaN(event.quantity) || event.quantity <= 0) {
      this.invusagejsonds.addWarnings(this.invusagejsonds.getId(event), {
        quantity: expectedNumberMessage,
      });
      event.errormsgtext = expectedNumberMessage;
      event.haswarning = true;
    } else if (event.quantity > event.calqty) {
      this.invusagejsonds.addWarnings(this.invusagejsonds.getId(event), {
        quantity: exceedlimitMessage,
      });
      event.errormsgtext = exceedlimitMessage;
      event.haswarning = true;
    } else {
      this.invusagejsonds.clearWarnings(event, "quantity");
      event.haswarning = false;
    }

    if (!event.haswarning) {
      this.computeEnableSave();
      this.app.currentPage.state.invalidInput.delete(event.anywhererefid);
    } else {
      // disable save and issue button if has warnings
      this.app.currentPage.state.enableSave = false;
      this.app.currentPage.state.invalidInput.add(event.anywhererefid);
    }
    this.validateInvUsage();
  }

  /**
   * Check if the Record is able to be Saved or Not
   *      * @param {Boolean} enableSave  - Flag to idicate if the save is allowed
   */
  computeEnableSave() {
    if (this.page.state.draftInvUsage) {
      this.app.currentPage.state.enableSave =
        !!this.page.state.invusagedesc &&
        // customization (sedin change)
		    !!this.page.state.bpuissueto &&
        !this.page.state.completedItem &&
        !!this.page.state.usetype_maxvalue;
    } else {
      // BPUCustomisation -- Enable save button only when issueTo field is selected or value is changed.																							  
      this.app.currentPage.state.enableSave =
        !!this.page.state.invusagedesc &&
        !!this.page.state.bpuissueto && // customization (Sedin Change)
        !this.page.state.completedItem &&
        !!this.page.state.usetype_maxvalue &&
        ((this.page.state.invusagedesc !== this.page.params.description) ||
          (this.page.state.bpuissueto !== this.page.params.bpuissueto) || // customization (Sedin Change)
		      this.hasRealChangesOnJSONDS()) &&
        !this.page.state.readonlyState;
    }
  }

  /**
   * Shows the confirmation dialog for delete.
   */
  showDelConfirmation(item) {
    this.page.state.selectedItem = item;
    this.page.state.dialogBMXMessage = this.app.getLocalizedLabel(
      "delConfirmBmxLabel",
      "Are you sure you want to delete the Item?"
    );

    // istanbul ignore next
    if (
      this.app.currentPage.state.enableSave &&
      this.page.state.currentInvUse !== null &&
      this.invUsageDS.item.invuseline?.filter(
        (existingitem) => existingitem.invuselinenum === item.invuselinenum
      ).length > 0
    ) {
      this.app.toast(
        this.app.getLocalizedLabel(
          "needSave",
          "You need to save the record before delete operation."
        ),
        "error"
      );
    } else {
      /* istanbul ignore next  */
      window.setTimeout(() => {
        this.page.showDialog(DEL_INVUSELINE_CONFIRM_DIALOG);
      }, 100);
    }
  }

  /**
   * Deletes invuseline when user confirm Yes.
   */
  async onUserConfirmationYes() {
    await this.removeLineItem(this.page.state.selectedItem);

    this.page.findDialog("invUsageLineItemDetails")?.closeDialog();
    this.validateInvUsage();
  }

  /**
   * Deletes invuseline when user confirm No.
   */
  async onUserConfirmationNo() {
    this.page.findDialog(DEL_INVUSELINE_CONFIRM_DIALOG)?.closeDialog();
  }

  removePreviousSelected(item) {
    let itemsInvUsage = this.page.state.itemsInvUsage;
    //istanbul ignore else
    if (itemsInvUsage) {
      // CHECK: use invuselinenum as unique
      this.page.state.itemsInvUsage = itemsInvUsage.filter(
        (usageItem) => usageItem.invuselinenum !== item.invuselinenum
      );
    }
  }

  async removeLineItem(item) {
    this.setSavingProcess(true);
    const isMaximoMobile = this.app.device.isMaximoMobile;
    if (
      !this.page.state.draftInvUsage &&
      (this.app.device.isMaximoMobile || item.href !== undefined)
    ) {
      const currentInvUseLines = this.invuselines.filter(
        (eachInvUseLine) => eachInvUseLine.invuselinenum === item.invuselinenum
      );
      // istanbul ignore else
      if (currentInvUseLines && currentInvUseLines.length > 0) {
        const childInvUseLineDS = this.invUsageDS.getChildDatasource(
          "invuseline",
          this.invUsageDS.item,
          { idAttribute: "invuseid" }
        );
        await childInvUseLineDS.load();
        await this.triggerDeleteProcess(childInvUseLineDS, currentInvUseLines);
        // Updates this.invuselines
        this.invuselines = this.invuselines.filter(
          (eachline) => eachline.invuselinenum !== item.invuselinenum
        );
        // Updates this.app.allinvuses, mobile filter with anywhererefid
        this.app.allinvuses = this.app.allinvuses.filter(
          (eachline) =>
            (isMaximoMobile && eachline.anywhererefid !== item.anywhererefid) ||
            (!isMaximoMobile && eachline.invuselineid !== item.invuselineid)
        );
      }
    }

    // Prepares the data for json data source reload.
    const copiedInvUsageJSONItems = Object.assign(
      {},
      this.invusagejsonds.items.filter(
        (existingitem) => existingitem.invuselinenum !== item.invuselinenum
      )
    );
    let newItemsArray = [];
    for (let key in copiedInvUsageJSONItems) {
      newItemsArray.push(copiedInvUsageJSONItems[key]);
    }

    await this.invusagejsonds.deleteItem(item);
    // Reloads invusagejsonds to avoid the problem that sometimes all the unsaved invuselines were deleted.
    await this.invusagejsonds.load({
      src: newItemsArray,
      noCache: true,
    });
    // remove from page.state.invalidInput and page.state.invalidInvUsage
    this.page.state.invalidInput.delete(item.anywhererefid);
    this.page.state.invalidInvUsage.delete(item.anywhererefid);
    this.removePreviousSelected(item);
    this.computeEnableSave();
    this.invUsageDS.clearChanges();
    this.setSavingProcess(false);
  }

  openSelectReservedItems() {
    this.app.setCurrentPage({
      name: reservationsListPage,
      params: {
        addmoreitems: true,
        reservedItemsInvUsage: this.page.state.itemsInvUsage,
        itemUrl: this.page.state.itemUrl,
        title: this.page.state.currentInvUse?.invusenum,
        description: this.page.state.invusagedesc,
      },
    });
  }

  openSelectInventoryItems() {
    this.app.setCurrentPage({
      name: invItemListPage,
      params: {
        addmoreitems: true,
        inventoryItemsInvUsage: this.page.state.itemsInvUsage,
        storeroom: this.page.state.invusagefromstoreloc,
        siteid: this.app.client.userInfo.defaultStoreroomSite,
        itemUrl: this.page.state.itemUrl,
        title: this.page.state.currentInvUse?.invusenum,
        description: this.page.state.invusagedesc,
      },
    });
  }

  async closeInvUsagePage() {
    let name = mainPage;
    let params = {
      addmoreitems: false,
    };
    //istanbul ignore else
    if (!this.app.state.isFromReservedItemsPage && this.page.params.itemUrl) {
      this.app.state.isBackFromInvUsePage = true;
      name = invUsageListPage;
      params = {
        addmoreitems: false,
      };
    }

    if (this.app.currentPage.state.enableSave) {
      // Display 'Save or Discard' dialog manually.
      this.showUnsavedChangesDialogManually(
        name,
        params,
        this.page.state.saveErr === null
      );
    } else {
      this.app.setCurrentPage({
        name: name,
        params: params,
      });
    }
  }

  showUnsavedChangesDialogManually(name, params, valid) {
    // istanbul ignore next
    let onAfterDiscard = () => {
      this.app.setCurrentPage({
        name: name,
        params: params,
      });
    };

    // istanbul ignore next
    let onAfterSave = () => {
      if (this.page.state.saveErr) {
        this.page.showDialog(INVUSE_SAVEERR_DIALOG);
      } else if (!this.page.state.saveValidationErr) {
        this.app.setCurrentPage({
          name: name,
          params: params,
        });
      }
    };

    this.app.userInteractionManager.showUnsavedChanges(
      this.app,
      this.page,
      onAfterSave,
      onAfterDiscard,
      // no callback after the x close button is clicked.
      null,
      this.app.isSavable() && valid
    );
  }

  async onCustomSaveTransition(event) {
    await this.saveInventoryUsage();
    // Not to call system defaultSave.
    return { saveDataSuccessful: true, callDefaultSave: false };
  }

  hasRealChangesOnJSONDS() {
    let invuselineChanged = false;
    const changes = this.invusagejsonds.__itemChanges;
    const fields = [
      "quantity",
      "issueto",
      "tobin",
      "tolot",
      "toconditioncode",
      "tostoreloc",
      "fromconditioncode",
      "refwo",
      "taskid",
      "assetnum",
      "location",
      "issueTo",
      "mrnum",
    ];
    for (let key in changes) {
      for (let field of fields) {
        //istanbul ignore else
        if (changes[key][field] !== undefined) {
          invuselineChanged = true;
          break;
        }
      }
    }

    return invuselineChanged || this.invsplitjsonDS.state.itemsChanged;
  }

  async openDetailsLineItem(item) {
    // set values from relation invreserve
    //istanbul ignore else
    if (item.issueto) {
      await this.issuetoLookupDS.initializeQbe();
      this.issuetoLookupDS.setQBE("personid", "=", item.issueto);
      const results = await this.issuetoLookupDS.searchQBE();
      item.issuetoDisplay =
        results && results.length ? results[0].displayname : "";
    }
    //istanbul ignore else
    if (item.invreserve && item.invreserve.length) {
      //istanbul ignore else
      if (
        !item.item &&
        item.invreserve[0].item &&
        item.invreserve[0].item.length
      ) {
        item.item = item.item || {};
        item.item.rotating = item.invreserve[0].item[0].rotating;
        item.item.conditionenabled =
          item.invreserve[0].item[0].conditionenabled;
      }
    }

    if (item.item !== undefined && item.item.length > 0) {
      item.item = item.item[0];
    }

    this.page.state.invUsageLineItem = item;
    let isChanged = this.invsplitjsonDS.state.itemsChanged;
    // load invsplitjsonDS
    this.invsplitjsonDS.clearState();
    this.invsplitjsonDS.resetState();
    if (item.invuselinesplit && item.invuselinesplit.length) {
      await this.invsplitjsonDS.load({
        src: item.invuselinesplit,
        noCache: true,
      });
    } else {
      await this.invsplitjsonDS.load({
        src: [],
        noCache: true,
      });
    }
    try {
      this.invsplitjsonDS.state.itemsChanged = isChanged;
    } catch (e) {}
    const itemtype_maxvalue =
      this.page.state.invUsageLineItem.linetype_maxvalue;

    this.page.state.lineDetailsTitle =
      itemtype_maxvalue === TOOL
        ? this.app.getLocalizedLabel("toolDetailsTitle", "Tool details")
        : this.app.getLocalizedLabel("itemDetailsTitle", "Item details");

    this.page.state.itemTypeLabel =
      itemtype_maxvalue === TOOL
        ? this.app.getLocalizedLabel("tool_label", "Tool")
        : this.app.getLocalizedLabel("item_label", "Item");

    this.validateInvUsageLineItem(this.page.state.invUsageLineItem);
    this.page.showDialog("invUsageLineItemDetails");
  }

  async openIssuetoLookup() {
    this.page.updatePageLoadingState(true);
    // clear qbe for issuetoLookupDS
    this.issuetoLookupDS.clearSelections();
    this.issuetoLookupDS.clearState();
    await this.issuetoLookupDS.initializeQbe();
    await this.issuetoLookupDS.searchQBE();
    this.page.updatePageLoadingState(false);
    this.page.showDialog("issuetoLookup");
  }

  /**
   * Function to filter the Assets according to the parameters
   */
  async openAssetLookupByIssue() {
    this.page.state.loadingAssetByIssue = true;
    this.app.state.assetLookupMode = "single";

    let assetLookupDS = this.app.findDatasource("issueAssetLookupDS");
    await assetLookupDS.initializeQbe();
    assetLookupDS.setQBE(
      "siteid",
      "=",
      this.app.client.userInfo.defaultStoreroomSite
    );
    await assetLookupDS.searchQBE();
    assetLookupDS.clearSelections();

    this.page.state.loadingAssetByIssue = false;
    this.page.showDialog("issueAssetLookup");
  }

  /**
   * Function to filter the Assets according to the parameters
   */
  async openAssetLookup() {
    const invUsageLineItem = this.page.state.invUsageLineItem;
    this.page.state.loadingAsset = true;

    // clear previous search
    this.assetLookupDS.clearState();
    //Filter asset
    await this.assetLookupDS.initializeQbe();
    this.assetLookupDS.setQBE("siteid", "=", invUsageLineItem.siteid);
    this.assetLookupDS.setQBE("itemnum", "=", invUsageLineItem.itemnum);
    this.assetLookupDS.setQBE("location", "=", invUsageLineItem.fromstoreloc);
    // istanbul ignore else
    if (invUsageLineItem.conditioncode) {
      this.assetLookupDS.setQBE(
        "conditioncode",
        "=",
        invUsageLineItem.conditioncode
      );
    }
    await this.assetLookupDS.searchQBE();

    // rebuild selections from split
    this.assetLookupDS.clearSelections();

    const keyMap = {
      href: "splitHref",
      localref: "splitLocalref",
      anywhererefid: "anywhererefid",
      invuselinesplitid: "invuselinesplitid",
    };
    // use asset items in split to set selection for assetLookupDS
    const self = this;
    this.invsplitjsonDS.getItems().forEach((splitItem) => {
      // fill asset with splitjson fileds, especially for href, localref
      const assetItem = self.assetLookupDS.getItems().find((item) => {
        if (item.assetnum === splitItem.rotassetnum) {
          for (let key in keyMap) {
            // istanbul ignore else
            if (splitItem[key]) {
              item[keyMap[key]] = splitItem[key];
            }
          }
          return true;
        } else {
          return false;
        }
      });
      // istanbul ignore else
      if (assetItem) {
        assetItem._disabled = false;
        self.assetLookupDS.setSelectedItem(assetItem, true);
        self.assetLookupDS.setDisabled(assetItem);
      }
    });
    this.page.state.loadingAsset = false;
    this.page.showDialog("assetLookup");
  }

  /**
   * Use to set the selected item..
   * @param {item} Asset item
   */
  selectAssets() {
    this.chooseAsset();
  }

  async deleteAsset(item) {
    let success = true;
    this.page.updatePageLoadingState(true);
    //istanbul ignore else
    if (this.invUsageDS.state.currentItemIndex !== -1) {
      const childInvUseLineDS = this.invUsageDS.getChildDatasource(
        "invuseline",
        this.invUsageDS.item,
        { idAttribute: "invuseid" }
      );
      await childInvUseLineDS.load();
      const childInvSplitDS = childInvUseLineDS.getChildDatasource(
        "invuselinesplit",
        this.page.state.invUsageLineItem,
        { idAttribute: "invuselineid" }
      );
      const splitItems = await childInvSplitDS.load();
      // skip if the split item not saved
      let existing = false;
      if (this.app.device.isMaximoMobile) {
        existing = splitItems.find(
          // For mobile, the record can be deleted from local db if anywhererefid exists.
          (split) =>
            (split.anywhererefid &&
              split.anywhererefid === item.anywhererefid) ||
            (split.href && split.href === item.href)
        );
      } else {
        existing = splitItems.find(
          // For web version, we need to have href before delete.
          (split) => split.href && split.href === item.href
        );
      }
      // istanbul ignore else
      if (existing) {
        success = await childInvSplitDS.deleteItem(item);
      }
    }
    // istanbul ignore else
    if (success) {
      // filter the jsonDS no matter the split is saved or not
      const items = this.invsplitjsonDS
        .getItems()
        .filter((split) => split.invuselinesplitid !== item.invuselinesplitid);
      this.invsplitjsonDS.clearState();
      this.invsplitjsonDS.resetState();
      await this.invsplitjsonDS.load({
        src: items,
        noCache: true,
      });
    }
    this.page.updatePageLoadingState(false);
  }

  /**
   * Callback method after choose asset from lookup after validating location.
   * @param {item} asset item
   */
  async chooseAsset() {
    let selectedItems = this.assetLookupDS.getSelectedItems();

    selectedItems = selectedItems.map((item) => {
      const resultItem = {
        quantity: 1,
        frombin: item.binnum,
        rotassetnum: item.assetnum,
      };
      const keyMap = {
        splitHref: "href",
        splitLocalref: "localref",
        anywhererefid: "anywhererefid",
        invuselinesplitid: "invuselinesplitid",
      };
      for (let key in keyMap) {
        // istanbul ignore else
        if (item[key]) {
          resultItem[keyMap[key]] = item[key];
        }
      }
      return resultItem;
    });

    let currentItems = this.invsplitjsonDS.getItems();
    const newItems = [];

    if (currentItems && currentItems.length) {
      selectedItems?.forEach((item) => {
        let newSelectedItem = currentItems.find(
          (temp) => temp.rotassetnum === item.rotassetnum
        );
        //istanbul ignore next
        if (!newSelectedItem) {
          newItems.push(item);
        }
      });
      const self = this;
      newItems.forEach(async (item) => {
        let newAsset = await self.invsplitjsonDS.addNew();
        for (let key in item) {
          newAsset[key] = item[key];
        }
      });
    } else {
      this.invsplitjsonDS?.clearChanges();
      this.invsplitjsonDS?.clearState();
      this.invsplitjsonDS.lastQuery = {};
      const self = this;
      await selectedItems.forEach(async (item) => {
        let newAsset = await self.invsplitjsonDS.addNew();
        for (let key in item) {
          newAsset[key] = item[key];
        }
      });
    }
  }

  onDetailClose() {
    // close from detail sliding drawer chevron button

    // save invuselinesplit back to invuseline item
    this.page.state.invUsageLineItem.invuselinesplit =
      this.invsplitjsonDS.getItems();
    this.computeEnableSave();
  }

  async onSplitClose() {
    // close from split sliding drawer close button
    // restore previous state
    if (this.page.state.prevBin === null || this.page.state.prevQty === null) {
      await this.deleteSplit(true);
    } else {
      this.page.state.invUsageLineSplitItem.frombin = this.page.state.prevBin;
      this.page.state.invUsageLineSplitItem.quantity = this.page.state.prevQty;
    }
    this.page.state.invUsageLineSplitItem = null;
  }

  closeDrawer() {
    // display values do not update automatically when modified in mobile, update it manually
    this.page.state.invUsageLineSplitItem.displayedQuantity =
      this.app.getLocalizedLabel("splitQuantity", "Quantity: {0}", [
        this.page.state.invUsageLineSplitItem.quantity || 0,
      ]);
    this.page.state.invUsageLineSplitItem.displayedBin =
      this.app.getLocalizedLabel("splitBin", "From bin: {0}", [
        this.page.state.invUsageLineSplitItem.frombin || "-",
      ]);
    this.page.state.invUsageLineItem.frombin =
      this.page.state.invUsageLineItem.frombin ||
      this.page.state.invUsageLineSplitItem.frombin;
    this.page.state.invUsageLineSplitItem = null;
    // close split sliding drawer from delete/done
    this.app.userInteractionManager.removeDrawer(
      this.page.findDialogConfiguration(SPLIT_DRAWER)
    );
  }

  async deleteSplit(skipClose) {
    let success = true;
    //istanbul ignore else
    if (this.invUsageDS.state.currentItemIndex !== -1) {
      // delete existing split, come from click delete split button
      this.page.state.deletingSplit = true;
      const childInvUseLineDS = this.invUsageDS.getChildDatasource(
        "invuseline",
        this.invUsageDS.item,
        { idAttribute: "invuseid" }
      );
      await childInvUseLineDS.load();
      const childInvSplitDS = childInvUseLineDS.getChildDatasource(
        "invuselinesplit",
        this.page.state.invUsageLineItem,
        { idAttribute: "invuselineid" }
      );
      const splitItems = await childInvSplitDS.load();
      // skip if the split item not saved
      let existing = false;
      if (this.app.device.isMaximoMobile) {
        existing = splitItems.find(
          // For mobile, the record can be deleted from local db if anywhererefid exists.
          (item) =>
            (item.anywhererefid &&
              item.anywhererefid ===
                this.page.state.invUsageLineSplitItem.anywhererefid) ||
            (item.href &&
              item.href === this.page.state.invUsageLineSplitItem.href)
        );
      } else {
        existing = splitItems.find(
          // For web version, we need to have href before delete.
          (item) =>
            item.href &&
            item.href === this.page.state.invUsageLineSplitItem.href
        );
      }
      // istanbul ignore else
      if (existing) {
        success = await childInvSplitDS.deleteItem(
          this.page.state.invUsageLineSplitItem
        );
      }
      this.page.state.deletingSplit = false;
    }
    // istanbul ignore else
    if (success) {
      // filter the jsonDS no matter the split is saved or not
      const items = this.invsplitjsonDS
        .getItems()
        .filter(
          (split) =>
            split.invuselinesplitid !==
            this.page.state.invUsageLineSplitItem.invuselinesplitid
        );
      this.invsplitjsonDS.clearState();
      this.invsplitjsonDS.resetState();
      await this.invsplitjsonDS.load({
        src: items,
        noCache: true,
      });
    }

    // istanbul ignore else
    if (!skipClose) {
      this.closeDrawer();
    }
  }

  async configSplit(item) {
    // open sliding drawer for filling split item info
    if (!item) {
      item = await this.invsplitjsonDS.addNew();
      item.quantity = 0;
      item.frombin = this.page.state.invUsageLineItem.frombin;
      this.page.state.prevBin = null;
      this.page.state.prevQty = null;
    } else {
      this.page.state.prevBin = item.frombin;
      this.page.state.prevQty = item.quantity;
    }
    this.page.state.invUsageLineSplitItem = item;
    this.page.state.deletingSplit = false;
    this.page.showDialog(SPLIT_DRAWER);
  }

  /**
   * Function to filter the Bin/Bins according to the parameters
   */
  async openBinLookup(options) {
    let temp = this.binLookupDS.dataAdapter.colletionInfo
      ? await this.binLookupDS.dataAdapter.colletionInfo?.getMetrics(
          "lookup_INVBALANCES",
          { name: "lookup" }
        )
      : undefined;
    this.page.state.lastSyncDate = temp
      ? this.app.getLocalizedLabel("lastSync", "Last sync {0}.", [
          this.app.dataFormatter
            .convertISOtoDate(temp.downloaDate)
            .toLocaleString(),
        ])
      : undefined;

    let { splitItem, origin } = options;
    this.page.state.originLookup = origin;

    let invUsageLineItem = this.page.state.invUsageLineItem;
    this.page.state.invUsageLineSplitItem = splitItem;
    //Filter Bin

    let storerRoomOrigin =
      origin === TRANSFERSECTION ? "tostoreloc" : "fromstoreloc";
    let lotOrigin = origin === TRANSFERSECTION ? "tolot" : "fromlot";
    let conditioncodeOrigin =
      origin === TRANSFERSECTION ? "toconditioncode" : "fromconditioncode";
    await this.filterInvBalDS(
      invUsageLineItem.siteid,
      invUsageLineItem.itemnum,
      invUsageLineItem[storerRoomOrigin],
      invUsageLineItem[lotOrigin],
      invUsageLineItem[conditioncodeOrigin]
    );
    this.page.showDialog("binLookup");
  }

  chooseIssueto(evt) {
    // istanbul ignore else
    if (evt) {
      let invUsageLineItem = this.page.state.invUsageLineItem;
      invUsageLineItem.issuetoDisplay = evt.displayname;
      invUsageLineItem.issueto = evt.personid;
    }
    this.validateInvUsageLineItem(this.page.state.invUsageLineItem);
  }

  // Customization for bpuissuto (sedin change)
  chooseInvUseIssueto(evt)
  {
    if (evt)
    {
      this.page.state.bpuissueto = evt.personid;
    }
    this.computeEnableSave();
    this.validateInvUsage();							
  }
  
  // Customization for bpuwonum (sedin change)
  chooseInvUseBpuWonum(evt) 
  {
  if (evt) {
    this.page.state.bpuwonum = evt.wonum;
  }
  this.computeEnableSave();
  this.validateInvUsage();
  }
  

  /**
   * Function to choose the bin from lookup
   */
  chooseBinNumber(evt) {
    // istanbul ignore else
    if (evt) {
      // istanbul ignore else
      if (this.page.state.invUsageLineSplitItem) {
        this.page.state.originLookup === TRANSFERSECTION
          ? (this.page.state.invUsageLineSplitItem.tobin = evt.binnum)
          : (this.page.state.invUsageLineSplitItem.frombin = evt.binnum);
        return;
      }
      let invUsageLineItem = this.page.state.invUsageLineItem;

      if (this.page.state.originLookup === TRANSFERSECTION) {
        invUsageLineItem.tobin = evt.binnum;
        invUsageLineItem.tostoreloc = evt.location;
      } else {
        invUsageLineItem.frombin = evt.binnum;
      }

      this.validateInput(invUsageLineItem);
      this.validateInvUsageLineItem(invUsageLineItem);
    }
  }

  /**
   * Function to open a lookup according to the parameters
   */
  openLocalLookup(options) {
    let { name, target, ds } = options;
    this.page.state.returnFromLookup = target;
    this.app.findDatasource(ds).clearSelections();
    this.page.showDialog(name);
  }

  /**
   * Function to choose the item condition from lookup
   */
  async chooseConditionLookup(event) {
    // istanbul ignore else
    if (event) {
      this.page.state.invUsageLineItem.fromconditioncode = event.conditioncode;
      this.page.state.invUsageLineItem.toconditioncode = event.conditioncode;
    }
    await this.checkBin();
    this.validateInvUsageLineItem(this.page.state.invUsageLineItem);
  }

  async checkBin() {
    // istanbul ignore else
    if (this.page.state.invUsageLineItem.toconditioncode) {
      let invUsageLineItem = this.page.state.invUsageLineItem;

      await this.filterInvBalDS(
        invUsageLineItem.siteid,
        invUsageLineItem.itemnum,
        invUsageLineItem.fromstoreloc,
        invUsageLineItem.fromstoreloc,
        invUsageLineItem.fromconditioncode
      );

      let bin = this.binLookupDS.items.find(
        (item) => item.binnum === this.page.state.invUsageLineItem.frombin
      );

      // istanbul ignore else
      if (!bin) {
        this.page.state.invUsageLineItem.frombin = undefined;
      }
    }
  }

  //
  /**
   * Function to open a lookup according to the parameters
   */
  async openLocationLookup(options) {
    await this.filterLocationLookup(options.name);
    this.openLocalLookup(options);
  }

  async filterLocationLookup(lookup) {
    let ds = this.app.findDatasource("locationDS");

    // istanbul ignore else
    if (!ds.getSchema()) {
      await ds.initializeQbe();
    }
    ds.clearQBE();
    ds.setQBE("siteid", "=", this.page.state.invUsageLineItem.tositeid);
    // istanbul ignore else
    if (lookup === "storeRoomLookup") {
      const loctypeDS = this.app.findDatasource("loctypeDS");
      await loctypeDS.load();
      ds.setQBE("type", "=", loctypeDS.item.value);
    }

    await ds.searchQBE();
  }

  async chooseLocationLookup(event) {
    // istanbul ignore else
    if (event) {
      this.page.state.invUsageLineItem.location = event.location;
    }
    this.validateInvUsageLineItem(this.page.state.invUsageLineItem);
  }

  validateInvUsage() {
    // use invalid set to record the invalid lines
    const invalid = new Set();
    const ds = this.app.findDatasource("jsoninusageDS");
    let msgList = [];
    let itemValid;
    let itemId = 0;
    ds.items.forEach((invUsageLineItem) => {
      itemValid = this.validateInvUsageLineItem(invUsageLineItem);
      if (!itemValid) {
        let missingFields = this.getMissingInvUsageLineItemFields().toString();
        invalid.add(invUsageLineItem.anywhererefid);
        itemId++;
        let message;
        if (missingFields.length) {
          message = this.app.getLocalizedLabel(
            "missingFields",
            "The {0} cannot be blank for the {1} on item {2} line {3}.",
            [
              `<em>${missingFields}</em>`,
              this.page.state.usetype_maxvalue === ISSUE
                ? this.app.getLocalizedLabel("issue", "Issue")
                : this.app.getLocalizedLabel("transfer", "Transfer"),
              `<em>${invUsageLineItem.itemnum}</em>`,
              `<em>${invUsageLineItem.invuselinenum}</em>`,
            ]
          );
          msgList.push({
            id: itemId,
            msg: message,
          });
        }

        if (invUsageLineItem.tobin && invUsageLineItem.tobin.length > 8) {
          message = this.app.getLocalizedLabel(
            "invalidValue",
            "The {0} value is not valid to bin on item {1} line {2}.",
            [
              `<em>${invUsageLineItem.tobin}</em>`,
              `<em>${invUsageLineItem.itemnum}</em>`,
              `<em>${invUsageLineItem.invuselinenum}</em>`,
            ]
          );
          msgList.push({
            id: itemId,
            msg: message,
          });
        }
      }

      invUsageLineItem.isInValid = !itemValid;
    });

    if (!!invalid.size) {
      this.loadMsgDS(msgList);
    } else {
      this.loadMsgDS([]);
    }
    this.page.state.invalidInvUsage = invalid;
    return invalid.size === 0;
  }

  validateInvUsageLineItem(invUsageLineItem) {
    this.page.state.invUsageLineItemFields.invalid = {};
    this.page.state.invUsageLineItemFields.required = {};
    this.page.state.invUsageLineItemFields.warning = {};

    //CONDITION
    this.page.state.invUsageLineItemFields.required.fromCondition =
      invUsageLineItem.item?.conditionenabled;
    this.page.state.invUsageLineItemFields.invalid.fromCondition =
      invUsageLineItem.item?.conditionenabled &&
      !invUsageLineItem.fromconditioncode;

    //LOT
    this.page.state.invUsageLineItemFields.required.fromLot =
      invUsageLineItem.lottype === LOT ||
      invUsageLineItem.item?.lottype_maxvalue === LOT;
    this.page.state.invUsageLineItemFields.invalid.fromLot =
      this.page.state.invUsageLineItemFields.required.fromLot &&
      (!invUsageLineItem.fromlot ||
        invUsageLineItem.fromlot?.trim().length === 0);

    if (this.page.state.usetype_maxvalue === ISSUE) {
      //rotating check
      if (invUsageLineItem.item?.rotating) {
        this.page.state.invUsageLineItemFields.required.location =
          invUsageLineItem.location === undefined;
        this.page.state.invUsageLineItemFields.required.asset = false;
        this.page.state.invUsageLineItemFields.required.refwo = false;

        this.page.state.invUsageLineItemFields.invalid.location =
          this.page.state.invUsageLineItemFields.required.location;
        this.page.state.invUsageLineItemFields.invalid.asset =
          this.page.state.invUsageLineItemFields.required.asset;
        this.page.state.invUsageLineItemFields.invalid.refwo =
          this.page.state.invUsageLineItemFields.required.refwo;
      } else {
        this.page.state.invUsageLineItemFields.required.location =
          invUsageLineItem.location === undefined &&
          invUsageLineItem.assetnum === undefined &&
          (!invUsageLineItem.refwo || invUsageLineItem.refwo?.trim() === "");
        this.page.state.invUsageLineItemFields.required.asset =
          invUsageLineItem.location === undefined &&
          invUsageLineItem.assetnum === undefined &&
          (!invUsageLineItem.refwo || invUsageLineItem.refwo?.trim() === "");
        this.page.state.invUsageLineItemFields.required.refwo =
          invUsageLineItem.location === undefined &&
          invUsageLineItem.assetnum === undefined &&
          (!invUsageLineItem.refwo || invUsageLineItem.refwo?.trim() === "");

        this.page.state.invUsageLineItemFields.invalid.location =
          this.page.state.invUsageLineItemFields.required.location;
        this.page.state.invUsageLineItemFields.invalid.asset =
          this.page.state.invUsageLineItemFields.required.asset;
        this.page.state.invUsageLineItemFields.invalid.refwo =
          this.page.state.invUsageLineItemFields.required.refwo;
      }

      //lineType check
      if (invUsageLineItem.linetype === "TOOL") {
        this.page.state.invUsageLineItemFields.required.issueTo = true;
        this.page.state.invUsageLineItemFields.invalid.issueTo =
          !invUsageLineItem.issueto;
      } else {
        this.page.state.invUsageLineItemFields.required.issueTo = false;
        this.page.state.invUsageLineItemFields.invalid.issueTo = false;
      }
    } else if (this.page.state.usetype_maxvalue === TRANSFER) {
      //TO LOT
      this.page.state.invUsageLineItemFields.required.toLot =
        invUsageLineItem.lottype === LOT ||
        invUsageLineItem.item?.lottype_maxvalue === LOT;

      this.page.state.invUsageLineItemFields.invalid.toLot =
        this.page.state.invUsageLineItemFields.required.toLot &&
        (!invUsageLineItem.tolot ||
          invUsageLineItem.tolot?.trim().length === 0);

      //TO STOREROOM
      this.page.state.invUsageLineItemFields.required.toStoreloc = true;
      this.page.state.invUsageLineItemFields.invalid.toStoreloc =
        !invUsageLineItem.tostoreloc;

      //TO SITEID
      this.page.state.invUsageLineItemFields.required.toSiteId = true;
      this.page.state.invUsageLineItemFields.invalid.toSiteId =
        !invUsageLineItem.tositeid;

      //TO BIN
      this.page.state.invUsageLineItemFields.required.toBin = false;
      this.page.state.invUsageLineItemFields.invalid.toBin =
        invUsageLineItem.tobin && invUsageLineItem.tobin.length > 8;
      this.page.state.invUsageLineItemFields.warning.toBin =
        !invUsageLineItem.tobin || invUsageLineItem.tobin?.trim().length === 0;

      // TO CONDITION
      this.page.state.invUsageLineItemFields.required.toCondition =
        invUsageLineItem.item?.conditionenabled;
      this.page.state.invUsageLineItemFields.invalid.toCondition =
        invUsageLineItem.item?.conditionenabled &&
        !invUsageLineItem.toconditioncode;
    }

    const fields = [
      "location",
      "assetnum",
      "refwo",
      "fromCondition",
      "issueTo",
      "fromLot",
      "toLot",
      "toStoreloc",
      "toSiteId",
      "toBin",
      "toCondition",
    ];
    let valid = true;
    fields.forEach((field) => {
      if (this.page.state.invUsageLineItemFields.invalid[field]) {
        valid = false;
      }
    });

    this.computeEnableSave();
    invUsageLineItem.isInValid = !valid;
    return valid;
  }

  getMissingInvUsageLineItemFields() {
    const fields = [
      "location",
      "asset",
      "refwo",
      "fromCondition",
      "issueTo",
      "fromLot",
      "toLot",
      "toStoreloc",
      "toSiteId",
      "toCondition",
    ];
    const msgMap = {
      refwo: this.app.getLocalizedLabel("refwo", "Work order"),
      asset: this.app.getLocalizedLabel("asset", "Asset"),
      location: this.app.getLocalizedLabel("location", "Location"),
      fromCondition: this.app.getLocalizedLabel("fromCondition", "Condition"),
      issueTo: this.app.getLocalizedLabel("person", "Person"),
      fromLot: this.app.getLocalizedLabel("fromLot", "Lot"),
      toLot: this.app.getLocalizedLabel("worktoLotOrder", "To lot"),
      toStoreloc: this.app.getLocalizedLabel("toStoreloc", "To storeroom"),
      toSiteId: this.app.getLocalizedLabel("toSiteId", "To site"),
      toCondition: this.app.getLocalizedLabel("toCondition", "To condition"),
    };

    let missingFields = [];
    fields.forEach((field) => {
      if (this.page.state.invUsageLineItemFields.invalid[field]) {
        missingFields.push(this.app.getLocalizedLabel(field, msgMap[field]));
      }
    });

    return missingFields;
  }

  /**
   * Function to choose the item attribute from lookup
   */
  async chooseStoreRoomLookup(event) {
    // istanbul ignore else
    if (event) {
      let invUsageLineItem = this.page.state.invUsageLineItem;
      await this.filterInvBalDS(
        invUsageLineItem.tositeid,
        invUsageLineItem.itemnum,
        event.location
      );
      this.page.state.invUsageLineItem.tostoreloc = event.location;

      if (this.binLookupDS.items?.length === 1) {
        this.page.state.invUsageLineItem.tobin = this.binLookupDS.item.binnum;
      } else {
        this.page.state.invUsageLineItem.tobin = null;
      }

      await this.loadLots(TRANSFERSECTION);
      let lotsFilteredByBinDS = this.page.datasources["lotsFilteredByBinDS"];
      if (lotsFilteredByBinDS.items?.length === 1) {
        this.page.state.invUsageLineItem.tolot =
          lotsFilteredByBinDS.item.lotnum;
      } else {
        this.page.state.invUsageLineItem.tolot = null;
      }

      this.validateInput(invUsageLineItem);
      this.validateInvUsageLineItem(invUsageLineItem);
    }
  }

  async filterInvBalDS(itemsetid, itemnum, location, lot, condition) {
    let invUsageLineItem = this.page.state.invUsageLineItem;
    // Considers the search input on the BIN lookup, which needs to be cleared.
    this.binLookupDS.clearState();
    this.binLookupDS.clearSelections();
    // istanbul ignore else
    if (!this.binLookupDS.getSchema()) {
      await this.binLookupDS.initializeQbe();
    }
    this.binLookupDS.clearQBE();

    this.binLookupDS.setQBE("itemnum", "=", itemnum);

    // istanbul ignore else
    if (itemsetid) {
      this.binLookupDS.setQBE("siteid", "=", itemsetid);
    }

    // istanbul ignore else
    if (location) {
      this.binLookupDS.setQBE("location", "=", location);
    }

    // istanbul ignore else
    if (condition) {
      this.binLookupDS.setQBE("conditioncode", "=", condition);
    }

    if (
      (invUsageLineItem.lottype_maxvalue === LOT ||
        invUsageLineItem.item?.lottype_maxvalue === LOT ||
        (invUsageLineItem.item?.length &&
          invUsageLineItem.item[0]?.lottype_maxvalue === LOT)) &&
      lot
    ) {
      this.binLookupDS.setQBE("lotnum", "=", lot);
    }

    await this.binLookupDS.searchQBE();
  } // Generated by

  /**
   * Function to load possible lots
   */
  async loadLots(origin) {
    const invUsageLineItem = this.page.state.invUsageLineItem;
    let lots = [];
    const lotsMap = {};
    let storerRoomOrigin =
      origin === TRANSFERSECTION ? "tostoreloc" : "fromstoreloc";
    await this.filterInvBalDS(
      invUsageLineItem.siteid,
      invUsageLineItem.itemnum,
      invUsageLineItem[storerRoomOrigin]
    );

    //Populate the possible Lots
    this.binLookupDS?.getItems()?.forEach((item) => {
      if (item.lotnum) {
        // we only need unique lot in the list later
        lotsMap[item.lotnum] = item;
      }
    });
    // get unique lots
    lots = Object.values(lotsMap);

    const lotsFilteredByBinDS = this.page.datasources["lotsFilteredByBinDS"];
    lotsFilteredByBinDS.clearSelections();
    //istanbul ignore next
    await lotsFilteredByBinDS.load({
      src: lots,
      noCache: true,
    });
  }

  /**
   * Function to filter the Bin/Bins according to the parameters
   */
  async openLotLookup(options = {}) {
    let { origin } = options;
    this.page.state.originLookup = origin;
    await this.loadLots(origin);
    this.page.showDialog("lotLookup");
  }

  /**
   * Function to choose the lot from lookup
   */
  async chooseLotNumber(evt) {
    let invUsageLineItem = this.page.state.invUsageLineItem;

    let lotAttr, binAttr, storeroomAttr;
    if (this.page.state.originLookup === TRANSFERSECTION) {
      lotAttr = "tolot";
      binAttr = "tobin";
      storeroomAttr = "tostoreloc";
    } else {
      binAttr = "frombin";
      lotAttr = "fromlot";
    }

    // istanbul ignore else
    if (evt && invUsageLineItem[lotAttr] !== evt.lotnum) {
      invUsageLineItem[lotAttr] = evt.lotnum;
      invUsageLineItem[binAttr] = evt.binnum;
      storeroomAttr && (invUsageLineItem[storeroomAttr] = evt.location);
      // reset split
      delete invUsageLineItem.invuselinesplit;
      this.invsplitjsonDS.clearState();
      this.invsplitjsonDS.resetState();
      await this.invsplitjsonDS.load({
        src: [],
        noCache: true,
      });
      // check default frombin consistent with lot chosen
      const binItems = this.binLookupDS.getItems();
      const found = binItems?.find((item) => {
        // istanbul ignore next
        return (
          item.binnum === invUsageLineItem[binAttr] &&
          item.lotnum === invUsageLineItem[lotAttr]
        );
      });
      // istanbul ignore else
      if (!found) {
        invUsageLineItem[binAttr] = "";
      }
      this.validateInvUsageLineItem(invUsageLineItem);
    }
  }

  loadMsgDS(msgList) {
    let newSRC = { items: msgList };
    let msgDS = this.app.findDatasource("msgDS");
    // istanbul ignore else
    if (msgDS) {
      msgDS.clearState();
      msgDS.resetState();
      msgDS.lastQuery = {};
      msgDS.dataAdapter.src = newSRC;
      msgDS.load({ src: newSRC });
    }
  }

  /**
   * Function to open Add options sliding drawer
   */
  openAddOptionsDrawer() {
    this.loadOptions();
    this.page.showDialog("addOptions");
  }

  async loadOptions() {
    let addoptions = [
      {
        _id: 0,
        label: this.app.getLocalizedLabel("reservations", "Reservations"),
        page: reservationsListPage,
      },
      {
        _id: 1,
        label: this.app.getLocalizedLabel("inventoryItems", "Inventory items"),
        page: invItemListPage,
      },
      {
        _id: 2,
        label: this.app.getLocalizedLabel("returnItems", "Return items"),
        page: invItemListPage, // customization (sedin change)
      },
      {
        _id: 3,
        label: this.app.getLocalizedLabel("stockedTools", "Stocked tools"),
        page: "",
      },
      {
        _id: 4,
        label: this.app.getLocalizedLabel("returnTools", "Return tools"),
        page: "",
      },
    ];

    // istanbul ignore else
    if (this.page.state.usetype_maxvalue === TRANSFER) {
      addoptions.splice(4, 1);
      addoptions.splice(3, 1);
      addoptions.splice(2, 1);
      addoptions.splice(0, 1);
    } else if (this.page.state.usetype_maxvalue === ISSUE) {
      addoptions.splice(4, 1);
      addoptions.splice(3, 1);
      addoptions.splice(2, 1);
    } 
    // customization (sedin change)
    else if (this.page.state.usetype_maxvalue === MIXED) {
      addoptions.splice(0, 2); 
      addoptions.splice(1, 2); 
	  }

    await this.addoptionsds.load({
      src: {
        items: addoptions,
      },
    });
  }

  /**
   * Event handler
   *
   * @param {Object} args - Contains event with page property
   */
  chooseOption(args) {
    this.page.findDialog("addOptions").closeDialog();
    switch (args.page) {
      case reservationsListPage:
        this.openSelectReservedItems();
        break;
      case invItemListPage:
        this.openSelectInventoryItems();
        break;
      //customization (sedin change)
      case "invItemListPage":
        this.openSelectInventoryItems();
          break;
      default:
        log.d(TAG, "No matched option");
    }
  }

  shipValidation() {
    const toSiteSet = new Set();
    const itemList = [];
    let itemId = 0;
    this.invusagejsonds.getItems().forEach((item) => {
      log.d(TAG, "item: %o", item);
      // add item.tositeid to set
      toSiteSet.add(item.tositeid);
      itemId++;
      const message = this.app.getLocalizedLabel(
        "differentToSite",
        "The 'To site' value is {0} for item {1}, line {2}.",
        [
          `<em>${item.tositeid}</em>`,
          `<em>${item.itemnum}</em>`,
          `<em>${item.invuselinenum}</em>`,
        ]
      );
      itemList.push({
        id: itemId,
        msg: message,
      });
    });
    log.d(TAG, "tosite set size is: %s", toSiteSet.size);
    this.loadMsgDS(itemList);
    return toSiteSet.size === 1;
  }

  doShip() {
    log.d(TAG, "Do ship action");
    if (this.shipValidation()) {
      this.openCreateShipmentDialog();
    } else {
      this.page.state.shipVlidationErr_failed = this.app.getLocalizedLabel(
        "invalid_for_ship",
        "The status of inventory usage record cannot be changed to SHIPPED."
      );
      this.page.state.shipVlidationErr_inconsistent =
        this.app.getLocalizedLabel(
          "ship_in_same_site",
          "All records must be transferred to the same site."
        );
      this.page.showDialog("sysMsgDialog_shipValidationErr");
    }
  }

  /**
   * Function to stage, issue or transfer the current inventory usage
   */
  async changeStatus(status_maxvalue) {
    let needsSave = false;
    // check frombin in each invuseline and its split frombin
    this.invusagejsonds.items.forEach((item) => {
      //istanbul ignore else
      if (item.invuselinesplit && item.invuselinesplit.length) {
        let match = false;
        for (let i = 0; i < item.invuselinesplit.length; i++) {
          //istanbul ignore else
          if (item.invuselinesplit[i].frombin === item.frombin) {
            match = true;
            break;
          }
        }
        //istanbul ignore else
        if (!match) {
          // item.frombin is out of date, should be updated during save
          needsSave = true;
        }
      }
    });

    //istanbul ignore else
    if (
      !this.page.state.draftInvUsage &&
      this.app.currentPage.state.enableSave
    ) {
      needsSave = true;
    }

    let shipmentInfo = {};
    let shipmentFields = [
      "shipmentsiteid",
      "expreceiptdate",
      "packingslipnum",
      "shiptoattn",
      "carrier",
      "shipto",
      "shipmentdate",
      "shiptoattn",
    ];
    shipmentFields.forEach((field) => {
      shipmentInfo[field] = this.invUsageDS.item[field];
    });

    // For those invusage recs directly from Maximo side, we always need validation while not real save.
    const saveSuccess = await this.saveInventoryUsage(needsSave);
    // check save result, stop change status process if save failed.
    //istanbul ignore else
    if (!saveSuccess) {
      return;
    }

    shipmentFields.forEach((field) => {
      this.invUsageDS.item[field] = shipmentInfo[field];
    });
    this.setStatusProcess(true);
    // Prepares options data - status
    let status = status_maxvalue;
    const itemObj = await CommonUtil.cacheSynonymdomain(
      this.app,
      INVUSESTATUS_SYNONYM_DOMAINID,
      {
        key: "valueid",
        value: `${INVUSESTATUS_SYNONYM_DOMAINID}|${status}`,
      }
    );
    let statusDescription = "";
    //istanbul ignore else
    if (itemObj) {
      status = itemObj.value;
      statusDescription = itemObj.description;
    }
    // Prepares data - date
    let currDate = new Date();
    let dataFormatter = this.app.dataFormatter;
    currDate = dataFormatter.convertDatetoISO(currDate);
    let currentItem = this.invUsageDS.item;
    currentItem.status = status;
    currentItem.status_maxvalue = status_maxvalue;
    // istanbul ignore else
    if (status_maxvalue === INVUSE_STATUS_STAGED) {
      currentItem.binflag = this.page.state.binflag;
      currentItem.stagingbin = this.page.state.stagingbin;
    }
    let option = {
      interactive: false,
      responseProperties: "status",
    };
    //istanbul ignore next
    try {
      let response = await this.invUsageDS.save(option);
      // istanbul ignore else
      if (response && Array.isArray(response) && response.length > 0) {
        response = response[0]._responsedata;
      }
      //istanbul ignore next
      if (response) {
        if (!this.app.device.isMaximoMobile) {
          // Needs to remove the corresponding invuselines from this.app.allinvuses for web version.
          // It's because reservedqty of invreserve will be updated in maximo side synchronously after changing status.
          this.updateAppInvUseLines(currentItem, true);
        }
        if (status_maxvalue === INVUSE_STATUS_STAGED) {
          let label = this.app.getLocalizedLabel(
            "invusage_staged",
            "The items were staged."
          );
          this.app.toast(label, "success", "");
          // after stage success set stagedItem to true to disable Stage button
          this.page.state.stagedItem = true;
        } else if (status_maxvalue === INVUSE_STATUS_COMP) {
          let label;
          switch (this.page.state.usetype_maxvalue) {
            case ISSUE:
              label = this.app.getLocalizedLabel(
                "invusage_issued",
                "The items were issued."
              );
              break;
              // after issue success set completedItem to true to disable issue button
            case TRANSFER:
              label = this.app.getLocalizedLabel(
                "invusageTransfered",
                "The transfer was completed."
              );
              break;
            case MIXED: 
            label = this.app.getLocalizedLabel(
              "invusageReturned",
              "The return was completed."
            );
            break;
            default:
              break;
          }
          this.app.toast(label, "success", "");
          this.page.state.completedItem = true;
        }
      }
      this.computeEnableSave();
    } catch (error) {
      // istanbul ignore next
      log.t(TAG, error);
    }
    this.exitOptProcess();
  }

  /**
   * Click the stage button
   */
  doStage() {
    if (this.includeReturnedItems()) {
      this.page.showDialog(CANNOT_STAGE_DIALOG); // include returned items, cannot stage.
    } else {
      this.page.showDialog(CONFIRM_STAGE_BIN_DIALOG);
    }
  }

  /**
   * Check if there is at least one returned item
   */
  includeReturnedItems() {
    return this.invusagejsonds
      .getItems()
      .some((item) => item.usetype_maxvalue === RETURN);
  }

  /**
   * Click Save button on the confirm staging dialog
   */
  async onSave_confirmStagingDialog() {
    let needsSave = false;
    //istanbul ignore else
    if (
      !this.page.state.draftInvUsage &&
      this.app.currentPage.state.enableSave
    ) {
      needsSave = true;
    }
    await this.saveInventoryUsage(needsSave);
  }

  /**
   * Shows the confirm stage bin dialog
   */
  showConfirmStageBinDialog() {
    this.page.showDialog(CONFIRM_STAGE_BIN_DIALOG);
  }

  /**
   * set value to binflag
   */
  setBinflag(event) {
    this.page.state.binflag = event.innerId;
  }

  // clear shipment  fields
  resetShipmentFields() {
    let currDate = new Date();
    let dataFormatter = this.app.dataFormatter;

    this.invUsageDS.item.carrier = "";
    this.invUsageDS.item.shipmentdate =
      dataFormatter.convertDatetoISO(currDate);
    this.invUsageDS.item.shiptoattn = "";
    this.invUsageDS.item.expreceiptdate = "";
    this.invUsageDS.item.packingslipnum = "";
    this.invUsageDS.item.shipto = "";
    // Sets the required attribute only when user choose to ship. If user decides to cancel or close, needs to reset it as not required.
    // Usage : updateRequired(field, required, item, validate = true)
    this.invUsageDS.updateRequired(
      DS_ATTR_SHIPMENTDATE,
      false,
      this.invUsageDS.item,
      false
    );
    this.invUsageDS.clearWarnings(this.invUsageDS.item, DS_ATTR_SHIPMENTDATE);
  }
  // Generated by
  /*
  The openCreateShipmentDialog function opens a dialog box for creating a new shipment. 
  It does this by resetting the state of the shipment datasource, initializing the query
   builder expression (if necessary), adding a new item to the datasource, and setting various 
   properties on the new item. The function also sets the invalidshipto and invalidshiptoattn page
   state variables to false and calls the validShipment function, respectively. 
   Finally, it shows the CREATE_SHIPMENT_DIALOG dialog box.
  */
  async openCreateShipmentDialog() {
    this.resetShipmentFields();
    this.page.state.invalidshipto = false;
    this.page.state.invalidshiptoattn = false;
    // Sets the required attribute only when user choose to ship. If user decides to cancel, needs to reset it as not required.
    // Usage : updateRequired(field, required, item, validate = true)
    this.invUsageDS.updateRequired(
      DS_ATTR_SHIPMENTDATE,
      true,
      this.invUsageDS.item,
      true
    );

    await this.validShipment();
    this.page.showDialog(CREATE_SHIPMENT_DIALOG);
  }

  handleWOBarcodeScan(scandata) {
    this.page.state.invUsageLineItem.refwo = scandata.value;
    this.validateInvUsageLineItem(this.page.state.invUsageLineItem);
  }

  handleTaskBarcodeScan(scandata) {
    this.page.state.invUsageLineItem.taskid = scandata.value;
    this.validateInvUsageLineItem(this.page.state.invUsageLineItem);
  }

  /**
   * Function to choose the item attribute from lookup
   */
  chooseOptionLookupToShipment(options, event) {
    // istanbul ignore else
    if (event) {
      this.invUsageDS.item[options.target] = event[options.source];
      this.page.state[`invalid${options.target}`] = false;
    }
    this.validShipment();
  }

  /**
   * The purpose of the cleanAsset function is to clear the asset number from the
   * inventory usage line item object in the page state when the user clicks on the "Clear"
   * button next to the asset number field. This function is called when the user clicks on
   * the "Clear" button next to the asset number field in the inventory usage form.
   */

  cleanAsset() {
    this.page.state.invUsageLineItem.assetnum = undefined;
    this.validateInvUsageLineItem(this.page.state.invUsageLineItem);
  }

  /**
   * This function is used to clear the location field in the
   * inventory usage line item object when the user clicks the "Clear" button on the location field.
   * It also validates the inventory usage line item after clearing the location field.
   */
  cleanLocation() {
    this.page.state.invUsageLineItem.location = undefined;
    this.validateInvUsageLineItem(this.page.state.invUsageLineItem);
  }

  chooseIssueAsset(event) {
    // istanbul ignore else
    if (event) {
      this.page.state.invUsageLineItem.assetnum = event.assetnum;
      this.page.state.invUsageLineItem.location = event.location;
    }
    this.validateInvUsageLineItem(this.page.state.invUsageLineItem);
  }

  /*
    This function handles the barcode scan event for the packing slip number input field. 
     It updates the shipment status based on the selected option from the lookup.
  */
  handlePackingLipnumBarcodeScan(scandata) {
    this.chooseOptionLookupToShipment(
      { target: "packingslipnum", source: "value" },
      scandata
    );
  }

  // Generated by
  /*
  # getItemFromLookup

  Retrieves an item from a lookup datasource based on the given key and value.

  ## Parameters

  - `app`: The application object.
  - `ds`: The name of the datasource.
  - `key`: The key field of the lookup datasource.
  - `value`: The value field of the lookup datasource.

  ## Return Type

  `Promise<Array<any>>`

  ## Exceptions and Edge Cases

  - If the lookup datasource is not found or the key or value fields are invalid, an empty array will be returned.
  */
  async validShipment() {
    this.page.state.canShip =
      !this.page.state.invalidshipto &&
      !this.page.state.invalidshiptoattn &&
      this.invUsageDS.item.shipmentdate;
  }

  // Generated by
  /* 
  # executeShipment

  Executes the shipment by saving the shipment datasource, changing the status of the shipment to SHIPPED, displaying a toast message indicating that the shipment has been saved, and setting the saving state variable to false.

  ## Parameters

  None

  ## Return Type

  None

  ## Exceptions and Edge Cases

  None
  */
  async executeShipment() {
    this.setSavingProcess(true);

    try {
      this.page.state.saving = true;
      //  await this.invUsageDS.save();
      await this.changeStatus(SHIPPED_STATUS);
      let label = this.app.getLocalizedLabel(
        "invusageShiped",
        "The shipment was completed."
      );

      this.app.setCurrentPage({
        name: invUsageListPage,
      });
      this.app.toast(label, "success", "");
    } catch (error) {
      /* istanbul ignore next  */
      log.t(TAG, error);
    } finally {
      this.setSavingProcess(false);
    }
  }

  // Generated by
  /**
   * 
    # validateLookup

    Validates a lookup field and sets the corresponding value field on the shipment datasource.

    ## Parameters

    - `event`: The event object from the input field.
    - `lookupDSName`: The name of the lookup datasource.
    - `lookupField`: The name of the lookup field.
    - `valueField`: The name of the value field to set on the shipment datasource.

    ## Return Type

    `Promise<void>`

    ## Exceptions and Edge Cases

    - If the lookup field is empty or invalid, the value field will not be updated and the corresponding invalid state will be set to true.
   */
  async validateLookup(event, lookupDSName, lookupField, valueField) {
    this.page.state.canShip = false;
    //istanbul ignore else
    if (event?.value) {
      const item = await this.getItemFromLookup(
        this.app,
        lookupDSName,
        lookupField,
        event.value.toUpperCase()
      );
      if (item?.length) {
        this.page.state.invUsageLineItem[valueField] = item[0][valueField];
        this.page.state[`invalid${valueField}`] = false;
      } else {
        this.page.state[`invalid${valueField}`] = true;
      }
    } else {
      this.page.state[`invalid${valueField}`] = false;
    }
    this.validShipment();
  }

  // Generated by
  /**
     * 
      # validatePerson

      Validates the person ID field and sets the corresponding value field on the shipment datasource.

      ## Parameters

      - `event`: The event object from the input field.

      ## Return Type

      `Promise<void>`

      ## Exceptions and Edge Cases

      - If the person ID field is empty or invalid, the value field will not be updated and the corresponding invalid state will be set to true.
    */
  async validatePerson(event) {
    await this.validateLookup(
      event,
      "issuetoLookupDS",
      "personid",
      "shiptoattn"
    );
  }
  
  async validateWorkOrder(event) {
  await this.validateLookup
  (
    event,
    "wonumLookupDS",
    "wonum",
    "bpuwonum"
   );
  }

  /*    
    # validateShipTo

    Validates the ship-to address code field and sets the corresponding value field on the shipment datasource.

    ## Parameters

    - `event`: The event object from the input field.

    ## Return Type

    `Promise<void>`

    ## Exceptions and Edge Cases

    - If the ship-to address code field is empty or invalid, the value field will not be updated and the corresponding invalid state will be set to true.

    */
  async validateShipTo(event) {
    await this.validateLookup(event, "billtoshiptoDS", "addresscode", "shipto");
  }

  /*
    # getItemFromLookup

    Retrieves an item from a lookup datasource based on the given key and value.

    ## Parameters

    - `app`: The application object.
    - `ds`: The name of the datasource.
    - `key`: The key field of the lookup datasource.
    - `value`: The value field of the lookup datasource.

    ## Return Type

    `Promise<Array<any>>`

    ## Exceptions and Edge Cases

    - If the lookup datasource is not found or the key or value fields are invalid, an empty array will be returned.
    */
  async getItemFromLookup(app, ds, key, value) {
    //istanbul ignore else
    if (value !== "") {
      let lookupDs = this.page.findDatasource(ds);
      await lookupDs.initializeQbe();
      lookupDs.setQBE(key, "=", value);
      let items = await lookupDs.searchQBE();
      /* istanbul ignore else  */
      if (items.length <= 1) {
        await this.clearSearch(lookupDs);
      }

      return items;
    }
  }

  /**
   * Clear the datasource search
   * @param {ds} is database name
   */
  async clearSearch(ds) {
    /* istanbul ignore else  */
    if (ds && ds.lastQuery.qbe && JSON.stringify(ds.lastQuery.qbe) !== "{}") {
      ds.clearQBE();
      await ds.searchQBE(undefined, true);
    }
  }

  /**
   * open the shipto lookup
   */
  async openBilltoshiptoLookup() {
    // Changed to use saved-query way, thus no need to set qbe here.
    // const billtoshiptoDS = this.app.findDatasource("billtoshiptoDS");
    // await billtoshiptoDS.initializeQbe();
    // billtoshiptoDS.setQBE(
    //   "siteid",
    //   "=",
    //   this.invUsageDS.item.invuseline[0].tositeid
    // );
    // billtoshiptoDS.setQBE("shipto", "=1");
    // await billtoshiptoDS.searchQBE();
    this.openLocalLookup({ name: "billtoshiptoLookup", ds: "billtoshiptoDS" });
  }

  /**
   * open the shipto lookup
   */
  async openConditionLookup() {
    const conditionLookupDS = this.app.findDatasource("conditionLookupDS");
    await conditionLookupDS.initializeQbe();
    conditionLookupDS.setQBE(
      "itemnum",
      "=",
      this.page.state.invUsageLineItem.itemnum
    );
    await conditionLookupDS.searchQBE();
    this.openLocalLookup({
      name: "conditionCodeLookup",
      target: "fromconditioncode",
      ds: "conditionLookupDS",
    });
  }

  /**
   * Check maxvar txfrreqship, set value to page.state.shipRequired and page.state.canShipDuringTransfer
   */
  checkTransferMaxvar() {
    let currentUsage = this.invUsageDS.item;
    let txfrreqship = currentUsage.txfrreqship;
    let orgid = currentUsage.orgid;
    let siteid = currentUsage.siteid;
    let sentToSameSite = this.shipValidation();
    let toorgid = "";
    let tositeid = "";
    const toORGSet = new Set();
    this.invusagejsonds.getItems().forEach((item) => {
      toORGSet.add(item.toorgid);
      // istanbul ignore else
      if (toorgid === "") {
        toorgid = item.toorgid;
      }
      // istanbul ignore else
      if (tositeid === "") {
        tositeid = item.tositeid;
      }
    });

    if (txfrreqship === "ORG") {
      if (toORGSet.size === 1 && toorgid === orgid) {
        this.page.state.shipRequired = false;
      } else if (toORGSet.size === 1 && toorgid !== orgid) {
        this.page.state.shipRequired = true;
        if (sentToSameSite) {
          this.page.state.canShipDuringTransfer = true;
        } else {
          this.page.state.canShipDuringTransfer = false;
        }
      } else {
        // toORGSet.size != 1
        this.page.state.shipRequired = true;
        this.page.state.canShipDuringTransfer = false;
      }
    } else if (txfrreqship === "SITE") {
      if (sentToSameSite && tositeid === siteid) {
        this.page.state.shipRequired = false;
      } else if (sentToSameSite && tositeid !== siteid) {
        this.page.state.shipRequired = true;
        this.page.state.canShipDuringTransfer = true;
      } else {
        // sentToSameSite == false
        this.page.state.shipRequired = true;
        this.page.state.canShipDuringTransfer = false;
      }
    } else if (txfrreqship === "ALL") {
      this.page.state.shipRequired = true;
      if (sentToSameSite) {
        this.page.state.canShipDuringTransfer = true;
      } else {
        this.page.state.canShipDuringTransfer = false;
      }
    }
  }

  /**
   * Do Transfer, pop out different dialog according to the value of page.state.shipRequired and page.state.canShipDuringTransfer
   */
  doTransfer() {
    this.checkTransferMaxvar();
    // istanbul ignore else
    if (!this.page.state.shipRequired) {
      this.page.showDialog(SHIP_NOT_REQUIRED_DIALOG);
    } else if (
      this.page.state.shipRequired &&
      this.page.state.canShipDuringTransfer
    ) {
      this.page.showDialog(SHIP_REQUIRED_CANSHIP_DIALOG);
    } else if (
      this.page.state.shipRequired &&
      !this.page.state.canShipDuringTransfer
    ) {
      this.page.showDialog(SHIP_REQUIRED_CANNOTSHIP_DIALOG);
    }
    this.page.state.shipRequired = false;
    this.page.state.canShipDuringTransfer = false;
  }

  /**
   * Click Issue/Transfer button
   */
  completeUsage() {
    switch (this.page.state.usetype_maxvalue) {
      case ISSUE:
        this.changeStatus(INVUSE_STATUS_COMP); //Issue type usage, change status to COMPLETED;
        break;
      case TRANSFER:
        this.doTransfer(); //Transfer type usage, do transfer;
        break;
      case MIXED: 
       this.changeStatus(INVUSE_STATUS_COMP); //Issue type usage, change status to COMPLETED;
      break;
      default:
        break;
	}
  }
}

export default InventoryUsagePageController;
