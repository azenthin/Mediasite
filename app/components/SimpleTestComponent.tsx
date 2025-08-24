'use client';

import React from 'react';

const SimpleTestComponent = () => {
    return (
        <div className="flex-1 p-8">
            <h1 className="text-white text-2xl mb-4">Simple Test Component</h1>
            <p className="text-gray-400">
                If you see this and the terminal stops showing infinite compilations,
                then the issue is in HomePageContent or its dependencies.
            </p>
            <p className="text-gray-400 mt-4">
                Check your terminal - it should show normal compilation behavior now.
            </p>
        </div>
    );
};

export default SimpleTestComponent;


