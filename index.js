document.getElementById("convertBtn").addEventListener("click", function () {
    let sqlInput = document.getElementById("sqlInput").value;
    let sqlOutput = document.getElementById("sqlOutput");

    let convertedSql = convertSql(sqlInput);

    sqlOutput.value = convertedSql;
});

function convertSql(sql) {
    // Normalize SQL keywords to uppercase, case-insensitive matching
    sql = sql.replace(/\b(delete|insert|update|select|from|where|inner join|left join|right join|create table|drop table|alter table|merge|output|using|returning|on conflict|values|set|limit|top|distinct|as|join|on|group by|order by|having|union|like|in|not in|is|null|exists|select distinct|all)\b/gi, function (match) {
        return match.toUpperCase();
    });

    // Handle DML Statements
    sql = handleDmlStatements(sql);

    // Handle Data Type Conversion
    sql = handleDataTypes(sql);

    // Handle Built-in Function Conversion
    sql = handleFunctions(sql);

    // Handle Table Management
    sql = sql.replace(/\bcreate table\b/gi, 'CREATE TABLE');
    sql = sql.replace(/\bdrop table\b/gi, 'DROP TABLE');
    sql = sql.replace(/\balter table\b/gi, 'ALTER TABLE');

    // Handle Select INTO (SQL Server to PostgreSQL conversion)
    sql = sql.replace(/\bselect into\b/gi, 'CREATE TABLE AS SELECT');

    // Handle Select with Top (SQL Server to PostgreSQL conversion)
    sql = sql.replace(/\bselect top (\d+)\b/gi, 'SELECT $1');

    // Handle Insert INTO with Values
    sql = sql.replace(/\binsert into \S+ (.+) values \((.+)\)/gi, 'INSERT INTO $1 ($2) VALUES ($3) RETURNING *;');

    // Handle Merge (SQL Server to PostgreSQL conversion, for UPSERTs)
    sql = sql.replace(/\bmerge into\b/gi, 'INSERT INTO');
    sql = sql.replace(/\bwhen matched then\b/gi, 'ON CONFLICT DO UPDATE');
    sql = sql.replace(/\bwhen not matched then\b/gi, 'ON CONFLICT DO NOTHING');

    // Handle Delete Statement (SQL Server to PostgreSQL conversion)
    sql = handleDeleteStatements(sql);

    // Handle Functions, Stored Procedures, and Triggers (Basic placeholders for now)
    sql = handleFunctionsAndStoredProcedures(sql);

    return sql;
}

function handleDmlStatements(sql) {
    // Insert Statements
    sql = sql.replace(/\binsert into\b/gi, 'INSERT INTO');

    // Update Statements
    sql = sql.replace(/\bupdate\b/gi, 'UPDATE');

    // Delete Statements
    sql = handleDeleteStatements(sql);

    return sql;
}

function handleDeleteStatements(sql) {
    // Handle DELETE without FROM (direct deletion from a single table)
    sql = sql.replace(/\bdelete (\S+)\b/gi, 'DELETE FROM $1');

    // Handle DELETE with FROM (complex DELETE with joins or subqueries)
    sql = sql.replace(/\bdelete (\S+)\s+from\s+(\S+)\s+/gi, 'DELETE FROM $2 USING $3 WHERE $2.$1 = $3.$1');

    // Handle DELETE with OUTPUT DELETED clause (SQL Server to PostgreSQL RETURNING)
    sql = sql.replace(/\bdelete from (\S+)\s+output deleted\.(\w+)\s+where/gi, function (match, table, column) {
        return `DELETE FROM ${table} WHERE RETURNING ${column};`;
    });

    return sql;
}

function handleDataTypes(sql) {
    // SQL Server to PostgreSQL Data Type Conversion
    const dataTypeMap = {
        'int': 'INTEGER',
        'smallint': 'SMALLINT',
        'bigint': 'BIGINT',
        'varchar': 'TEXT',
        'nvarchar': 'TEXT',
        'char': 'CHAR',
        'nchar': 'CHAR',
        'datetime': 'TIMESTAMP',
        'date': 'DATE',
        'time': 'TIME',
        'bit': 'BOOLEAN',
        'decimal': 'NUMERIC',
        'float': 'DOUBLE PRECISION',
        'money': 'MONEY',
        'uniqueidentifier': 'UUID',
        'text': 'TEXT',
        'image': 'BYTEA',
        'binary': 'BYTEA',
        'varbinary': 'BYTEA',
        'real': 'REAL',
        'timestamp': 'TIMESTAMP'
    };

    Object.keys(dataTypeMap).forEach(function (key) {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        sql = sql.replace(regex, dataTypeMap[key]);
    });

    return sql;
}

function handleFunctions(sql) {
    // SQL Server to PostgreSQL Built-in Function Conversion
    const functionMap = {
        'GETDATE()': 'CURRENT_TIMESTAMP',
        'GETUTCDATE()': 'CURRENT_TIMESTAMP',
        'SYSDATETIME()': 'CURRENT_TIMESTAMP',
        'LEN()': 'LENGTH()',
        'ISNULL()': 'COALESCE()',
        'ISNULL': 'COALESCE',
        'GETDATE': 'CURRENT_TIMESTAMP',
        'DATEADD': 'DATE + INTERVAL',
        'DATEDIFF': 'DATE_PART',
        'NEWID()': 'UUID_GENERATE_V4()',
        'CAST': 'CAST',
        'CONVERT': 'CAST',
        'GETDATE': 'CURRENT_TIMESTAMP',
        'CHARINDEX': 'POSITION',
        'REPLACE': 'REPLACE',
        'SUBSTRING': 'SUBSTRING'
    };

    Object.keys(functionMap).forEach(function (key) {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        sql = sql.replace(regex, functionMap[key]);
    });

    return sql;
}

function handleFunctionsAndStoredProcedures(sql) {
    // Example: Handling SQL Server to PostgreSQL function conversion
    sql = sql.replace(/\bcreate function\b/gi, 'CREATE FUNCTION');
    sql = sql.replace(/\bdrop function\b/gi, 'DROP FUNCTION');
    sql = sql.replace(/\balter function\b/gi, 'ALTER FUNCTION');

    // For stored procedures, convert SQL Server's style to PostgreSQL's
    sql = sql.replace(/\bcreate procedure\b/gi, 'CREATE PROCEDURE');
    sql = sql.replace(/\bdrop procedure\b/gi, 'DROP PROCEDURE');
    sql = sql.replace(/\balter procedure\b/gi, 'ALTER PROCEDURE');

    // Trigger handling (basic conversion for now)
    sql = sql.replace(/\bcreate trigger\b/gi, 'CREATE TRIGGER');
    sql = sql.replace(/\bdrop trigger\b/gi, 'DROP TRIGGER');

    return sql;
}
