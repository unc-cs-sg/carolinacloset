let express = require("express"),
    request = require('request'),
    router = express.Router(),
    url = require('url'),
    itemService = require("../services/item-service"),
    authService = require("../services/authorization-service"),
    exceptionHandler = require("../exceptions/exception-handler");

router.get("/", async function(req, res) {
    let onyen = await authService.getOnyen(req);
    let userType = await authService.getUserType(onyen);
    if(userType !== "admin" && userType !== "volunteer") {
        res.sendStatus(403);
        return;
    }

    let response = {};
    
    res.render("admin/entry.ejs", {response: response, onyen: onyen, userType: userType});
});
  
router.get("/search", async function(req, res) {
    let onyen = await authService.getOnyen(req);
    let userType = await authService.getUserType(onyen);
    if(userType !== "admin" && userType !== "volunteer") {
        res.sendStatus(403);
        return;
    }

    let response = {};
    if(req.query.prevOnyen) response.prevOnyen = req.query.prevOnyen;
    try {
        response.items = await itemService.getItems(null, null);
    } catch(e)  {
        response.error = exceptionHandler.retrieveException(e);
    }

    res.render("admin/entry-search.ejs", {response: response, onyen: onyen, userType: userType});
});

router.post('/search', async function (req, res) {
    console.log("searchCTRL");
    let onyen = await authService.getOnyen(req);
    let userType = await authService.getUserType(onyen);
    if(userType !== "admin" && userType !== "volunteer") {
        res.sendStatus(403);
        return;
    }
    
    let response = {};
    try {
        let searchTerm = req.body.searchTerm === '' ? null : req.body.searchTerm;
        let barcode = req.body.barcode === '' ? null : req.body.barcode;
        response.items = await itemService.getItems(searchTerm, barcode);
        if(barcode && (response.items === undefined || response.items.length == 0)) {
            const url = "https://www.datakick.org/api/items/" + barcode;
            console.log(url);
            await request.get(url, (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    response.scanResult = JSON.parse(body);
                    console.log(response.scanResult);
                }
                res.render("admin/entry-search.ejs",{response: response, onyen: onyen, userType: userType});
            });
        }
        else res.render("admin/entry-search.ejs",{response: response, onyen: onyen, userType: userType});
    } catch(e)  {
        response.error = exceptionHandler.retrieveException(e);
    }
});
  
router.get("/manual", async function(req, res) {
    let onyen = await authService.getOnyen(req);
    let userType = await authService.getUserType(onyen);
    if(userType !== "admin" && userType !== "volunteer") {
        res.sendStatus(403);
        return;
    }
    
    response = {};
    if(req.query.success) {
        response.success = req.query.success;
        if (response.success === "0") {
            response.infoMessage = "Error updating item."
        } else if (response.success === "1") {
            response.infoMessage = "Item successfully updated!"
        }
    }
 
    let foundItem = {
        name: req.query.name,
        barcode: req.query.barcode,
        desc: req.query.decr
    };

    res.render("admin/entry-manual.ejs", {response: response, foundItem: foundItem, onyen: onyen, userType: userType});
});

router.post('/manual', async function(req, res) {
    let onyen = await authService.getOnyen(req);
    let userType = await authService.getUserType(onyen);
    if(userType !== "admin" && userType !== "volunteer") {
        res.sendStatus(403);
        return;
    }

    let response = {};
    try {
        let name = req.body.name;
        let barcode = req.body.barcode === "" ? null : req.body.barcode;
        let description = req.body.description;
        let count = req.body.count;

        if(barcode || name) {
            // try searching by barcode, then by name and desc
            let item = await itemService.getItemByBarcodeThenNameDesc(barcode, name, description);
            console.log(item);

            // if the item is found, we send back a message and the found item
            if (item) {
                response.itemFound = item;
                res.render("admin/entry-manual.ejs", {response: response, onyen: onyen, userType: userType});
                return;
            }
        }

        await itemService.createItem(name, barcode, description, count);
    } catch(e)  {
        response.error = exceptionHandler.retrieveException(e);
    }

    res.render("admin/entry-manual.ejs", {response: response, onyen: onyen, userType: userType});
});

router.post("/manual/update", async function(req, res) {
    let onyen = await authService.getOnyen(req);
    let userType = await authService.getUserType(onyen);
    if(userType !== "admin" && userType !== "volunteer") {
        res.sendStatus(403);
        return;
    }
    
    let id  = req.body.id;
    let quantity = req.body.quantity;

    console.log("Updating");
    
    try {
        if(quantity > 0) {
            console.log("Add");
            itemService.addItems(id, quantity, onyen, onyen);
        } else if (quantity < 0) {
            console.log("Remove");
            itemService.removeItems(id, quantity, onyen, onyen);
        }
        console.log("Updated");
        res.redirect(url.format({
            pathname:"/entry/manual",
            query: {
            "success": "1"
            }
        }));
    } catch(e) {
        console.log(e);
        res.redirect(url.format({
            pathname:"/entry/manual",
            query: {
            "success": "0"
            }
        }));
    }
});

router.post("/add", async function(req, res) {
    let volunteer_onyen = await authService.getOnyen(req);
    let userType = await authService.getUserType(volunteer_onyen);
    if(userType !== "admin" && userType !== "volunteer") {
        res.sendStatus(403);
        return;
    }
    
    let id  = req.body.id;
    let name = req.body.name;
    let barcode = req.body.barcode;
    let quantity = req.body.quantity;

    if(quantity > 0) {
        itemService.addItems(id, quantity, volunteer_onyen, volunteer_onyen);
    }

    res.redirect(url.format({
        pathname:"/entry/search",
        query: {
           "prevOnyen": onyen
        }
    }));
});

router.post("/remove", async function(req, res) {
    let volunteer_onyen = await authService.getOnyen(req);
    let userType = await authService.getUserType(volunteer_onyen);
    if(userType !== "admin" && userType !== "volunteer") {
        res.sendStatus(403);
        return;
    }

    let id  = req.body.id;
    let name = req.body.name;
    let barcode = req.body.barcode;
    let onyen = req.body.onyen;
    let quantity = req.body.quantity;

    if(quantity > 0) {
        itemService.removeItems(id, quantity, onyen, volunteer_onyen);
    }

    res.redirect(url.format({
        pathname:"/entry/search",
        query: {
           "prevOnyen": onyen
        }
    }));
});

router.post("/found", async function(req, res) {
    let onyen = await authService.getOnyen(req);
    let userType = await authService.getUserType(onyen);
    if(userType !== "admin" && userType !== "volunteer") {
        res.sendStatus(403);
        return;
    }
    
    let name = req.body.name;
    let barcode = req.body.barcode;
    let description = req.body.description;

    res.redirect("/entry/manual/?name=" + name + "&barcode=" + barcode + "&desc=" + description);
});

router.get('/import', async function(req, res, next) {
    let onyen = await authService.getOnyen(req);
    let userType = await authService.getUserType(onyen);
    if(userType !== "admin" && userType !== "volunteer") {
        res.sendStatus(403);
        return;
    }
    else {
        let response = {};
        res.render('admin/entry-import.ejs', {response: response, onyen: onyen, userType: userType});
    }
});

router.post('/import', async function(req, res, next) {
    let onyen = await authService.getOnyen(req);
    let userType = await authService.getUserType(onyen);
    if(userType !== "admin" && userType !== "volunteer") {
        res.sendStatus(403);
        return;
    }
    else {
        let response = {};

        if (req.files != null) {
            let file = req.files.file;
            if(!file.name.match(/\.csv$/i)) {
                response.failMessage = "Please upload a valid CSV file";
            }
            else {
                await itemService.appendCsv(file).then((result) => {
                if(result) response.successMessage = "Success!";
                else response.failMessage = "An error occurred with the CSV file. The error message can be found in the console.";
                }).catch((e) => {
                    response.failMessage = "An error occurred with the CSV file. The error message can be found in the console.";
                });
            }
        }
        else response.failMessage = "Please select a CSV file to upload"; // user never selected a file

        res.render('admin/entry-import.ejs', {response: response, onyen: onyen, userType: userType});
    }
});

module.exports = router;