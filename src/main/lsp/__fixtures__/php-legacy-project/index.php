<?php

require_once 'lib/functions.php';
require_once 'classes/Invoice.php';

echo format_amount(12.5);
$invoice = new Invoice();
echo $invoice->documentedCustomer()->name();
echo $invoice->undocumentedCustomer()->name();
echo TAX_RATE;

$method = 'total';
echo $invoice->$method();
