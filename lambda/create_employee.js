const mysql = require('mysql2/promise');
const Memcached = require('memcached');

// Replace with your Memcached endpoint and port
const memcached = new Memcached('cache02.jbgwl6.cfg.use1.cache.amazonaws.com:11211');

exports.handler = async (event) => {


    const empNo     = event.emp_no;
    const firstName = event.first_name;
    const lastName  = event.last_name;
    const deptName  = event.dept_name;
    const maxSalary = event.max_salary;

    // Provide default values if not supplied
    const birthDate = event.birth_date || '1990-01-01';
    const gender    = event.gender || 'M';
    const hireDate  = event.hire_date || '2025-01-01';

    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DB
        });

        // Begin transaction for atomic operation
        await connection.beginTransaction();

        // 1) Insert into employees table
        await connection.execute(
            `INSERT INTO employees (emp_no, birth_date, first_name, last_name, gender, hire_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [empNo, birthDate, firstName, lastName, gender, hireDate]
        );

        // 2) Insert into salaries table
        const today = new Date().toISOString().split('T')[0];
        await connection.execute(
            `INSERT INTO salaries (emp_no, salary, from_date, to_date)
             VALUES (?, ?, ?, '9999-01-01')`,
            [empNo, maxSalary, today]
        );

        // 3) Look up the dept_no from departments using deptName
        const [deptRows] = await connection.execute(
            `SELECT dept_no FROM departments WHERE dept_name = ?`,
            [deptName]
        );
        if (!deptRows.length) {
            throw new Error(`Department '${deptName}' not found.`);
        }
        const deptNo = deptRows[0].dept_no;

        // 4) Insert into dept_emp
        await connection.execute(
            `INSERT INTO dept_emp (emp_no, dept_no, from_date, to_date)
             VALUES (?, ?, ?, '9999-01-01')`,
            [empNo, deptNo, today]
        );

        // Commit the transaction
        await connection.commit();

        // Clear cache for top10 employees after a successful create operation
        await clearCache('top10_employees');

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Employee created successfully!' })
        };

    } catch (err) {
        console.error('Error creating employee:', err);
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
