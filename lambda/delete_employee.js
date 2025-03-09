const mysql = require('mysql2/promise');
const Memcached = require('memcached');

// Replace with your Memcached endpoint and port
const memcached = new Memcached('cache02.jbgwl6.cfg.use1.cache.amazonaws.com:11211');

exports.handler = async (event) => {
    // Get emp_no from the path parameters
    const empNo = event.pathParameters.empNo;

    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DB
        });

        await connection.beginTransaction();

        // Delete the employee from the employees table (cascading deletes remove related records)
        const [result] = await connection.execute(
            `DELETE FROM employees WHERE emp_no = ?`,
            [empNo]
        );

        // Commit the transaction
        await connection.commit();

        if (result.affectedRows === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: `Employee ${empNo} not found.` })
            };
        }

        // Clear cache for top10 employees after a successful delete operation
        await clearCache('top10_employees');

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Employee ${empNo} deleted successfully.` })
        };

    } catch (err) {
        console.error('Error deleting employee:', err);
        if (connection) {
            await connection.rollback().catch(() => null);
        }
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };

    } finally {
        if (connection) {
            await connection.end();
        }
    }
};

// Helper function to clear a cache key using Memcached
function clearCache(key) {
    return new Promise((resolve, reject) => {
        memcached.del(key, (err) => {
            if (err) {
                console.error("Error clearing cache:", err);
                return reject(err);
            }
            console.log(`Cache cleared for key: ${key}`);
            resolve();
        });
    });
}
