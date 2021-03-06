const { v4: uuidv4 } = require("uuid"),
    Order = require("../db/sequelize").orders,
    Transaction = require("../db/sequelize").transactions,
    Sequelize = require("sequelize"),
    Item = require("../db/sequelize").items,
    BadRequestException = require("../exceptions/bad-request-exception"),
    InternalErrorException = require("../exceptions/internal-error-exception");

var Op = Sequelize.Op;

/**
 * Retrieves and returns an order by id
 * @param {number} id
 */
exports.getOrder = async function (id) {
    try {
        let order = await Transaction.findOne({ where: { id: id } });
        if (!order || order.admin_id !== 'ORDER') {
            throw new BadRequestException("The transaction could not be retrieved.");
        }
        return order;
    } catch (e) {
        throw new InternalErrorException("A problem occurred when retrieving an order", e);
    }
}

/**
 * Retrieves and returns all orders
 */
exports.getAllOrders = async function () {
    try {
        let orders = await Transaction.findAll({
            where: {
                admin_id: "ORDER",
                status: { [Op.or]: ["pending", "inUse", "late"] }
            }
        });

        // update status on any late orders
        orders.forEach((trans) => {
            if (trans.status === "inUse" && trans.return_date < Date.now()) {
                this.markOrderLate(trans.id);
            }
        })

        return orders;
    } catch (e) {
        throw e;
    }
}

/**
 * Creates a new order
 * Takes a cart, an array of objects that contain item id and quantity
 * Creates a new Order object and creates a new transaction under that order for each cart item
 * If any single transaction fails, the order is rolled back
 * Returns true if successful, false if not
 * @param {array} cart
 * @param {string} onyen
 */
exports.createOrder = async function (cart, onyen) {
    let processQueue = {};
    let completedTransactions = [];

    const newOrderId = uuidv4();
    await Order.create({ id: newOrderId });

    // Adds item to process queue, combines duplicate items
    cart.forEach((item) => {
        processQueue[item.id] = processQueue[item.id] === undefined ? item.quantity : currQuantity + item.quantity;
    });

    try {
        // Creates transactions for each item in the process queue
        for(id in processQueue) {
            quantity = processQueue[id];

            // Skips if quantity is zero or less
            if (quantity <= 0) return;

            let item = await Item.findOne({ where: { id: id } });
            if (!item) {
                throw new BadRequestException("The item doesn't exist in our inventory");
            }

            // Throws an error if there aren't enough in stock
            if (quantity > 0 && item.count < quantity) {
                throw new BadRequestException("The amount requested for " + item.name + " is " + (quantity - item.count) + " more than the quantity in the system");
            }

            // Throws an error if this user has an unreturned order
            let existingTransaction = await Transaction.findOne({
                where: {
                    admin_id: "ORDER",
                    onyen: onyen,
                    status: { [Op.or]: ["inUse", "late"] }
                }
            })
            
            if (existingTransaction) {
                throw new BadRequestException("Please return your outstanding items before placing a new order");
            }

            let transaction = await Transaction.build({
                id: '',
                order_id: newOrderId,
                item_id: id,
                item_name: item.name,
                count: -quantity,
                onyen: onyen,
                admin_id: "ORDER",
                status: 'pending'
            });

            await transaction.save();

            // changes item count, but if it fails, roll back this transaction
            try {
                await item.increment('count', { by: -quantity });
            } catch (e) {
                await this.deleteOrder(transaction.id, 'ORDER');
                throw e;
            }

            delete processQueue[id];
            completedTransactions.push(transaction);
        }

        return true;
    } catch (e) {
        console.error(e);
        // If one transaction fails, we delete each of them and revert the counts
        completedTransactions.forEach(async (transaction) => {
            this.deleteOrder(transaction.id);
            let item = await Item.findOne({ where: { id: transaction.item_id } });
            await item.increment('count', { by: -(transaction.count) });
        });

        await Order.destroy({ where: { id: newOrderId } });

        throw e;
    }
}

/**
 * Marks an order as in use and creates a return date
 * @param {number} orderId
 */
exports.executeOrder = async function (orderId) {
    try {
        let order = await this.getOrder(orderId);
        order.status = 'inUse';
        order.return_date = Date.now() + 2.628e+9, // set return date a month from now
        order.save();
    } catch (e) {
        throw new InternalErrorException("A problem occurred when executing order", e);
    }
}

/**
 * Marks an order as late
 * @param {number} orderId 
 */
exports.markOrderLate = async function (orderId) {
    try {
        let order = await this.getOrder(orderId);
        order.status = 'late';
        order.save();
    } catch (e) {
        throw new InternalErrorException("A problem occurred when completing order", e);
    }
}

/**
 * Marks an order as confirmed/completed
 * @param {number} orderId 
 * @param {onyen} adminId 
 */
exports.completeOrder = async function (orderId, adminId) {
    try {
        let order = await this.getOrder(orderId);
        order.admin_id = adminId;
        order.status = 'complete';
        order.save();
    } catch (e) {
        throw new InternalErrorException("A problem occurred when completing order", e);
    }
}

/**
 * Marks an order as cancelled
 * @param {number} orderId 
 * @param {onyen} adminId 
 */
exports.cancelOrder = async function (orderId, adminId) {
    try {
        let order = await this.getOrder(orderId);
        order.admin_id = adminId;
        order.status = 'cancelled';
        order.save();
        let itemId = order.item_id;
        await this.putbackCancelledItems(itemId, -order.count);
    } catch (e) {
        throw new InternalErrorException("A problem occurred when cancelling order", e);
    }
}

/**
 * Deletes an order by id
 * @param {number} orderId 
 */
exports.deleteOrder = async function (orderId) {
    try {
        await Transaction.destroy({
            where: {
                id: orderId
            }
        });
    } catch (e) {
        throw new InternalErrorException("A problem occurred when deleting order", e);
    }
}

/**
 * Re-adds quantity of an item that was reserved by an order
 * @param {number} itemId 
 * @param {number} count 
 */
exports.putbackCancelledItems = async function (itemId, count) {
    try {
        let item = await Item.findOne({ where: { id: itemId } });
        item.increment('count', { by: count });
    } catch (e) {
        throw e;
    }
}