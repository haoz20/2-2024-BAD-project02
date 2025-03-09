const mysql = require('mysql2/promise');

exports.handler = async (event) => {
    // Retrieve emp_no from path parameters (e.g., /employees/{empNo})
    const empNo = event.pathParameters ? event.pathParameters.empNo : event.emp_no;
    
    if (!empNo) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Missing 'emp_no' parameter" })
        };
    }
    
    let connection;
    try {
        // 1) Connect to MySQL using environment variables
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DB
        });

        // 2) Define the query to retrieve employee info along with their department and max salary.
        const query = `
            SELECT e.emp_no, e.first_name, e.last_name, d.dept_name, MAX(s.salary) AS max_salary
            FROM employees e
            JOIN current_dept_emp c ON e.emp_no = c.emp_no
            JOIN departments d ON c.dept_no = d.dept_no
            JOIN salaries s ON e.emp_no = s.emp_no
            WHERE e.emp_no = ?
            GROUP BY e.emp_no, e.first_name, e.last_name, d.dept_name;
        `;
        
        // 3) Execute the query using the provided empNo
        const [rows] = await connection.execute(query, [empNo]);
        
        // 4) Check if the employee was found
        if (rows.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: `Employee ${empNo} not found.` })
            };
        }
        
        // 5) Return the result as JSON (only one row is expected)
        return {
            statusCode: 200,
            body: JSON.stringify(rows[0])
        };

    } catch (error) {
        console.error("Error reading employee data:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    } finally {
        // 6) Ensure the connection is closed
        if (connection) {
            await connection.end();
        }
    }
};
