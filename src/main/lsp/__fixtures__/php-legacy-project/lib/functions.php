<?php

define('TAX_RATE', 0.2);

/**
 * Formats an amount for display.
 *
 * @param float $amount Amount to format.
 * @return string The formatted amount.
 */
function format_amount($amount)
{
    return number_format($amount, 2) . ' EUR';
}

/**
 * Adds the tax to an amount.
 *
 * @param float $amount Amount before tax.
 * @return float Amount including tax.
 */
function add_tax($amount)
{
    return $amount * (1 + TAX_RATE);
}
