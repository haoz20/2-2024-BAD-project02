const mysql = require('mysql2/promise');
const Memcached = require('memcached');

exports.handler = async (event) => {
    let connection;
    // Directly input the Memcached endpoint.
    const memcachedEndpoint = 'cache02.jbgwl6.cfg.use1.cache.amazonaws.com:11211';
    const memcached = new Memcached(memcachedEndpoint);

    try {
        // Get the employee number from the path parameters
        const empNo = event.pathParameters.empNo;

        // Read the fields directly from the event object
        const firstName = event.first_name;  // optional
        const lastName = event.last_name;    // optional
        const deptName = event.dept_name;    // required
        const maxSalary = event.max_salary;  // required

        // Validate required fields: empNo is from the URL, deptName and maxSalary from the body
        if (!empNo || !deptName || !maxSalary) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'emp_no (in path), dept_name, and max_salary are required.' })
            };
        }

        // Create a connection to the database
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DB
        });

        // Begin a transaction so that all updates occur together
        await connection.beginTransaction();

        // Update optional fields if provided
        if (firstName) {
            await connection.execute(
                'UPDATE employees SET first_name = ? WHERE emp_no = ?',
                [firstName, empNo]
            );
        }
        if (lastName) {
            await connection.execute(
                'UPDATE employees SET last_name = ? WHERE emp_no = ?',
                [lastName, empNo]
            );
        }

        // Retrieve the department number (dept_no) using the provided dept_name
        const [deptRows] = await connection.execute(
            'SELECT dept_no FROM departments WHERE dept_name = ?',
            [deptName]
        );
        if (deptRows.length === 0) {
            await connection.rollback();
            return {
                statusCode: 404,
                body: JSON.stringify({ message: `Department '${deptName}' not found.` })
            };
        }
        const deptNo = deptRows[0].dept_no;

        // Update the department assignment in the dept_emp table:
        // For simplicity, delete the current row for the employee and insert a new one.
        await connection.execute('DELETE FROM dept_emp WHERE emp_no = ?', [empNo]);
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const futureDate = '9999-01-01'; // arbitrarily far-future date
        await connection.execute(
            'INSERT INTO dept_emp (emp_no, dept_no, from_date, to_date) VALUES (?, ?, ?, ?)',
            [empNo, deptNo, today, futureDate]
        );

        // Update max salary in the salaries table.
        // We'll update the record with the latest from_date.
        const [salaryRows] = await connection.execute(
            'SELECT MAX(from_date) AS latest FROM salaries WHERE emp_no = ?',
            [empNo]
        );
        if (salaryRows.length === 0 || !salaryRows[0].latest) {
            await connection.rollback();
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Salary record not found for this employee.' })
            };
        }
        const latestDate = salaryRows[0].latest;
        await connection.execute(
            'UPDATE salaries SET salary = ? WHERE emp_no = ? AND from_date = ?',
            [maxSalary, empNo, latestDate]
        );

        // Commit the transaction once all updates are done
        await connection.commit();

        // Clear the top10 employees cache in Memcached.
        // Assume the cache key for the top10 data is "top10_employees".
        await new Promise((resolve) => {
            memcached.del('top10_employees', (err) => {
                if (err) {
                    console.error("Error deleting memcache key:", err);
                }
                resolve();
            });
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Employee updated successfully.' })
        };

    } catch (error) {
        console.error("Error updating employee:", error);
        if (connection) await connection.rollback();
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error updating employee.', error: error.message })
        };
    } finally {
        if (connection) await connection.end();
        memcached.end();
    }
};
